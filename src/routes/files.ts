import { Router } from "express";
import fs from "fs/promises";
import dotenv from "dotenv";
import path from "path";
import { createReadStream } from "fs";

dotenv.config();

const router = Router();


router.get("/", async (_req, res) => {

    //Grab location from env
    const storageLocation = process.env.FILE_STORAGE_PATH;

    //Ensure we have the storage location set
    if (!storageLocation) {
        return res.status(500).json({
            ok: false,
            error: "FILE_STORAGE_PATH not configured",
        });
    }

    try {

        //Read directory entries
        const entries = await fs.readdir(storageLocation, {
            withFileTypes: true,
        });

        //Build file and folder lists with metadata
        const files = [];
        const folders = [];

        for (const entry of entries) {
            if (entry.isFile()) {
                const stat = await fs.stat(path.join(storageLocation, entry.name));
                files.push({
                    name: entry.name,
                    size: stat.size,
                });
            } else if (entry.isDirectory()) {
                //Check if this is a photos folder
                if (entry.name.endsWith("-photos")) {
                    const photoFolderPath = path.join(storageLocation, entry.name);
                    const photoEntries = await fs.readdir(photoFolderPath, { withFileTypes: true });

                    //Get the prefix (folder name without -photos suffix)
                    const prefix = entry.name.slice(0, -7); // Remove "-photos"

                    for (const photoEntry of photoEntries) {
                        if (photoEntry.isFile()) {
                            const photoStat = await fs.stat(path.join(photoFolderPath, photoEntry.name));
                            const ext = path.extname(photoEntry.name);
                            const baseName = path.basename(photoEntry.name, ext);

                            files.push({
                                name: `${prefix}-photo-${baseName}${ext}`,
                                size: photoStat.size,
                                isPhoto: true,
                                originalPath: `${entry.name}/${photoEntry.name}`,
                            });
                        }
                    }
                } else {
                    folders.push(entry.name);
                }
            }
        }

        //Return the counts and lists
        res.json({
            ok: true,
            fileCount: files.length,
            folderCount: folders.length,
            files,
            folders,
        });
    } catch (err) {
        console.error("File read error:", err);

        //Respond with error
        res.status(500).json({
            ok: false,
            error: "Failed to read storage directory",
        });
    }
});
router.get("/download/:filename", async (req, res) => {
    const storageLocation = process.env.FILE_STORAGE_PATH;

    if (!storageLocation) {
        return res.status(500).json({ ok: false, error: "FILE_STORAGE_PATH not configured" });
    }

    const filename = req.params.filename;
    
    if (!filename || filename.length > 255) {
        return res.status(400).json({ ok: false, error: "Invalid filename" });
    }

    try {
        // Resolve + normalize to prevent "../" traversal
        const base = path.resolve(storageLocation);
        let fullPath = path.resolve(base, filename);

        //Check if this is a flattened photo filename (contains -photo-)
        const photoMatch = filename.match(/^(.+)-photo-(.+)$/);
        if (photoMatch) {
            const [, prefix, photoFile] = photoMatch;
            const photoFolderName = `${prefix}-photos`;
            fullPath = path.resolve(base, photoFolderName, photoFile);
        }

        if (!fullPath.startsWith(base + path.sep)) {
            return res.status(400).json({ ok: false, error: "Invalid path" });
        }

        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) {
            return res.status(404).json({ ok: false, error: "Not a file" });
        }

        // Helpful headers
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

        // Stream the file
        createReadStream(fullPath).pipe(res);
    } catch (err: any) {
        if (err?.code === "ENOENT") {
            return res.status(404).json({ ok: false, error: "File not found" });
        }
        console.error("Download error:", err);
        return res.status(500).json({ ok: false, error: "Failed to download file" });
    }
});
export default router;