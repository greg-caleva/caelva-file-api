import { Request, Response } from 'express';
import * as fileService from "../services/file.service";
import { InvalidFileNameError, InvalidPathError, NotAFileError } from '../errors/file/fileErrors';
import path from "path";
import fs from "fs/promises";
import { createReadStream } from 'fs';


export const getFiles = async (req: Request, res: Response) => {
    //Grab location from env
    const storageLocation = fileService.getStorageLocation();

    //Build file and folder lists with metadata
    const { files, folders } = await fileService.getFiles(storageLocation);

    //Return the counts and lists
    res.status(200).json({
        ok: true,
        fileCount: files.length,
        folderCount: folders.length,
        files,
        folders,
    });

}

export const downloadFile = async (req: Request, res: Response) => {

    //Early validation
    const filename = req.params.filename;
    if (!filename || filename.length > 255) {
        throw new InvalidFileNameError();
    }

    const storageLocation = fileService.getStorageLocation();

    let base = "";
    let fullPath = "";

    try {
        //Resolve + normalize to prevent traversal
        base = path.resolve(storageLocation);
        fullPath = path.resolve(base, filename);
    } catch (error) {
        throw new InvalidPathError();
    }



    //Check if this is a flattened photo filename (contains -photo-)
    const photoMatch = filename.match(/^(.+)-photo-(.+)$/);
    if (photoMatch) {
        const [, prefix, photoFile] = photoMatch;
        const photoFolderName = `${prefix}-photos`;
        fullPath = path.resolve(base, photoFolderName, photoFile);
    }

    if (!fullPath.startsWith(base + path.sep)) {
        throw new InvalidPathError();
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
        throw new NotAFileError();
    }

    // Helpful headers
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

    // Stream the file
    createReadStream(fullPath).pipe(res);


}