import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Request, Response, NextFunction, Express } from "express";
import { TLSSocket } from "node:tls";

type KeyRecord = {
    keyId: string;
    keyHash: string; // base64
    createdAt: string; // ISO
    revoked: boolean;
    certFingerprint?: string | null;
};

type PairingStoreData = {
    version: 1;
    pinHash: string; // base64 (HMAC(pepper, pin))
    keys: KeyRecord[];
};

type IssueKeyResult = {
    apiKey: string; // base64 random
    keyId: string;
};

type RateEntry = {
    fails: number;
    lockedUntil: number; // epoch ms
};

declare global {
    namespace Express {
        interface Request {
            _pairRate?: {
                fail: () => void;
                success: () => void;
            };
        }
    }
}

const STORE_FILENAME = "pairing.json";

//Ensure a required env var is set before starting
function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var ${name}`);
    return v;
}

//HMAC-SHA256, output base64
function hmacBase64(pepper: string, value: string): string {
    return crypto.createHmac("sha256", pepper).update(value).digest("base64");
}

//Constant-time comparison of two base64 strings
function constantTimeEqualBase64(aB64: string, bB64: string): boolean {
    try {
        const a = Buffer.from(aB64, "base64");
        const b = Buffer.from(bB64, "base64");
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

//Generate a random API key
function randomApiKeyBase64(bytes = 32): string {
    return crypto.randomBytes(bytes).toString("base64");
}

function nowIso(): string {
    return new Date().toISOString();
}

//Make sure a directory exists
async function ensureDir(dirPath: string): Promise<void> {
    await fsp.mkdir(dirPath, { recursive: true });
}

//Write a JSON file to disk
async function atomicWriteJson(filePath: string, obj: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    const tmp = path.join(dir, `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
    const json = JSON.stringify(obj, null, 2);
    await fsp.writeFile(tmp, json, { encoding: "utf8" });
    await fsp.rename(tmp, filePath); // atomic on same filesystem
}

export class PairingStore {

    //Location of store file
    private folderPath: string;

    //Full path to store file
    private filePath: string;

    //Pepper for HMACs
    private pepper: string;


    private pinHashFromEnv?: string;
    private pinPlainFromEnv?: string;

    public data: PairingStoreData;

    constructor(opts: {
        folderPath: string;
        pepper: string;
        pairPin?: string;
        pairPinHash?: string;
    }) {
        this.folderPath = opts.folderPath;
        this.filePath = path.join(opts.folderPath, STORE_FILENAME);
        this.pepper = opts.pepper;

        this.pinPlainFromEnv = opts.pairPin;
        this.pinHashFromEnv = opts.pairPinHash;

        if (!this.pinPlainFromEnv && !this.pinHashFromEnv) {
            throw new Error("Missing PAIR_PIN or PAIR_PIN_HASH");
        }

        this.data = {
            version: 1,
            pinHash: "", // filled on load/init
            keys: [],
        };
    }

    async load(): Promise<void> {

        //Ensure folder exists
        await ensureDir(this.folderPath);

        //Load existing data if present
        if (fs.existsSync(this.filePath)) {
            const raw = await fsp.readFile(this.filePath, "utf8");
            const parsed = JSON.parse(raw) as Partial<PairingStoreData>;

            const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
            const pinHash = typeof parsed.pinHash === "string" ? parsed.pinHash : "";

            this.data = {
                version: 1,
                pinHash,
                keys: keys as KeyRecord[],
            };            
        }

        //Initialize pinHash if missing
        if (!this.data.pinHash) {
            const pinHash =
                this.pinHashFromEnv ??
                hmacBase64(this.pepper, String(this.pinPlainFromEnv ?? ""));
            this.data.pinHash = pinHash;
            await this.save();
        }
    }

    //Save current data to disk
    async save(): Promise<void> {
        await atomicWriteJson(this.filePath, this.data);
    }

    //Verify a pairing pin
    verifyPin(pin: string): boolean {
        //We store pinHash as HMAC(pepper, pin) in the pairing file.
        const candidate = hmacBase64(this.pepper, pin);

        //Compare in constant time
        return constantTimeEqualBase64(candidate, this.data.pinHash);
    }


    //Issue a new API key
    async issueNewKey(opts?: { certFingerprint?: string | null }): Promise<IssueKeyResult> {

        //Generate new random API key
        const apiKey = randomApiKeyBase64(32);

        //Give the key a unique ID
        const keyId = `k_${Date.now()}`;

        //Generate key hash using cert fingerprint
        const fp = opts?.certFingerprint ?? null;
        const material = fp ? `${apiKey}:${fp}` : apiKey;

        //HMAC(pepper, material)
        const keyHash = hmacBase64(this.pepper, material);

        //Store the new key
        this.data.keys.push({
            keyId,
            keyHash,
            createdAt: nowIso(),
            revoked: false,
            certFingerprint: fp,
        });

        //And save
        await this.save();
        return { apiKey, keyId };
    }

    validateApiKey(apiKey: string | undefined, opts?: { certFingerprint?: string | null }): boolean {
        if (!apiKey) return false;

        const fp = opts?.certFingerprint ?? null;
        const material = fp ? `${apiKey}:${fp}` : apiKey;

        const candidateHash = hmacBase64(this.pepper, material);

        for (const rec of this.data.keys) {
            if (rec.revoked) continue;
            if (constantTimeEqualBase64(candidateHash, rec.keyHash)) return true;
        }
        return false;
    }
}

//Very simple per-IP rate limiter for /pair attempts
export function createPairRateLimiter() {

    const map = new Map<string, RateEntry>();

    return function pairRateLimit(req: Request, res: Response, next: NextFunction) {
        const ip =
            (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
            req.ip ||
            req.socket.remoteAddress ||
            "unknown";

        const now = Date.now();
        const entry = map.get(ip) ?? { fails: 0, lockedUntil: 0 };

        if (entry.lockedUntil && now < entry.lockedUntil) {
            return res.status(429).json({ error: "Too many attempts. Try again later." });
        }

        req._pairRate = {
            fail: () => {
                entry.fails += 1;
                if (entry.fails >= 5) {
                    entry.lockedUntil = now + 60_000; // 1 minute lockout after 5 fails
                }
                map.set(ip, entry);
            },
            success: () => {
                map.delete(ip);
            },
        };

        next();
    };
}

function getClientCertFingerprint256(req: Request): string | null {
    const anyReq = req as any;
    const cert = anyReq.socket?.getPeerCertificate?.();
    return cert?.fingerprint256 ?? null;
}

export function requireMtlsAndApiKey(store: PairingStore) {
    return (req: Request, res: Response, next: NextFunction) => {
        // With rejectUnauthorized:true, untrusted clients won't connect,    
        if (!isMtlsAuthorized(req)) {
            return res.status(401).json({ error: "mTLS required" });
        }

        const apiKey = req.header("X-API-KEY") ?? undefined;
        const certFp = getClientCertFingerprint256(req);

        if (!store.validateApiKey(apiKey, { certFingerprint: certFp })) {
            return res.status(403).json({ error: "Invalid API key" });
        }

        next();
    };
}

function isMtlsAuthorized(req: Request): boolean {
    const s = req.socket as TLSSocket;
    return s.authorized === true;
}

export function registerPairRoutes(app: Express, store: PairingStore) {

    //Grab limiter
    const pairRateLimit = createPairRateLimiter();

    //Post with pairing, through rate limiter
    app.post("/pair", pairRateLimit, async (req: Request, res: Response) => {
        try {
            //If mTLS not authorized, reject
            if (!isMtlsAuthorized(req)) {
                return res.status(401).json({ error: "mTLS required" });
            }
            //Grab pin from body
            const pin = String((req.body as any)?.pin ?? "");

            //Validate pin exists
            if (!pin) return res.status(400).json({ error: "Missing pin" });

            //Validate pin is correct
            if (!store.verifyPin(pin)) {
                req._pairRate?.fail();
                return res.status(403).json({ error: "Invalid pin" });
            }

            req._pairRate?.success();

            const certFp = getClientCertFingerprint256(req);
            const { apiKey, keyId } = await store.issueNewKey({ certFingerprint: certFp });

            return res.status(200).json({ apiKey, keyId });
        } catch {
            return res.status(500).json({ error: "Pairing failed" });
        }
    });
}

// Convenience factory using env vars
export async function createPairingStoreFromEnv(): Promise<PairingStore> {
    const folderPath = requireEnv("API_KEY_LOCATION");
    const pepper = requireEnv("API_KEY_PEPPER");
    const pairPin = process.env.PAIR_PIN;
    const pairPinHash = process.env.PAIR_PIN_HASH;

    const store = new PairingStore({ folderPath, pepper, pairPin, pairPinHash });
    await store.load();
    return store;
}
