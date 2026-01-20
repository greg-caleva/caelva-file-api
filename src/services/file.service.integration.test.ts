import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import * as fileService from "./file.service";
import { DirectoryNotFoundError, StorageLocationNotDefinedError } from '../errors/file/fileErrors';

import fs from 'fs/promises';
import path from 'path';
import os from 'os';


describe('getStorageLocation', () => {
    const originalEnv = process.env.FILE_STORAGE_PATH;

    afterEach(() => {
        //Restore after each test
        process.env.FILE_STORAGE_PATH = originalEnv;
    });

    it("should return the storage location", () => {
        process.env.FILE_STORAGE_PATH = "/some/path";
        const location = fileService.getStorageLocation();
        expect(location).toBe("/some/path");
    })

    it("should error when env not configured", () => {
        delete process.env.FILE_STORAGE_PATH;
        expect(() => fileService.getStorageLocation()).toThrow(StorageLocationNotDefinedError);
    })
});

describe('getFiles', () => {
    let tempDir: string;

    beforeEach(async () => {
        //Create a unique temp directory for each test
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-'));
    });

    afterEach(async () => {
        //Clean up temp dir after each test
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should return files with metadata", async () => {

        //Create a test file
        const fileName = "test.txt";
        const fileContent = "hello"
        await fs.writeFile(path.join(tempDir, fileName), fileContent);

        //Get files
        const result = await fileService.getFiles(tempDir);

        //Check results
        expect(result.files).toHaveLength(1);
        expect(result.files[0].name).toBe(fileName);
        expect(result.files[0].isFile).toBe(true);
        expect(result.files[0].isPhoto).toBe(false);
    });

    it("should return folders", async () => {

        //Create test folder
        const subfolderName = "subfolder"
        await fs.mkdir(path.join(tempDir, subfolderName));

        //Run
        const result = await fileService.getFiles(tempDir);

        //Check folders list contains test folder
        expect(result.folders).toContain(subfolderName);
    });

    it("should flatten -photos folders into files", async () => {

        const folderPath = "document-photos"
        const photoName = "test-photo.jpg"

        //Create a photos folder with an image
        await fs.mkdir(path.join(tempDir, folderPath));
        await fs.writeFile(path.join(tempDir, folderPath, photoName), 'FAKE-IMAGE');

        //Get the files/folders
        const result = await fileService.getFiles(tempDir);

        //Check we got a file back
        expect(result.files).toHaveLength(1);

        //Check the file name
        expect(result.files[0].name).toBe(`document-photo-${photoName}`);

        //Check that it is a photo
        expect(result.files[0].isPhoto).toBe(true);

        //Check original path was restored
        expect(result.files[0].originalPath).toBe(`${folderPath}/${photoName}`);

        //Photos folder should NOT appear in folders list
        expect(result.folders).not.toContain(folderPath);
    });

    it("should throw DirectoryNotFoundError for invalid path", async () => {
        await expect(fileService.getFiles('/nonexistent/path'))
            .rejects.toThrow(DirectoryNotFoundError);
    });
});