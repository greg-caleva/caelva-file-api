import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { createPairingStoreFromEnv, registerPairRoutes, requireMtlsAndApiKey } from "./auth/pairing-auth";
import filesRouter from "./routes/files";
import healthRouter from "./routes/health";
import helmet from "helmet";
import morgan from "morgan";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";


async function main() {
    const app = express();
    app.use(express.json());
    app.use(morgan("dev"));

    const store = await createPairingStoreFromEnv();

    const port = Number(process.env.PORT ?? 4004);

    //Pairing route (does not require X-API-KEY)
    registerPairRoutes(app, store);

    //Everything below requires mTLS + X-API-KEY
    app.use(requireMtlsAndApiKey(store));

    //Security middleware
    app.use(helmet());
    app.use(express.json({ limit: "2mb" }));

    app.use("/health", healthRouter);
    app.use("/files", filesRouter);

    // 404 + error handling
    app.use(notFound);
    app.use(errorHandler);

    const devMode = process.env.DEV_MODE === "true";

    if (devMode) {
        //Dev mode: plain HTTP without certs
        http.createServer(app).listen(port, () => {
            console.log(`[DEV MODE] API listening on http://0.0.0.0:${port}`);
        });
    } else {
        //Production: mTLS with certs
        //Ca: Certificate Authority (our own CA)
        //Server: Our server cert signed by our CA
        //Key: Private key for our server cert
        const tlsOptions: https.ServerOptions = {
            key: fs.readFileSync(`${process.env.CERT_DIR}/server.key`),
            cert: fs.readFileSync(`${process.env.CERT_DIR}/server.crt`),
            ca: fs.readFileSync(`${process.env.CERT_DIR}/ca.crt`),
            requestCert: true,
            rejectUnauthorized: true,
        };

        https.createServer(tlsOptions, app).listen(port, () => {
            console.log(`mTLS API listening on https://0.0.0.0:${port}`);
        });
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
