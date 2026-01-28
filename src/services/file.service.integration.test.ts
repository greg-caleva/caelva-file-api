import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import * as fileService from "./file.service";
import { DirectoryNotFoundError, InvalidPathError, NotAFileError, StorageLocationNotDefinedError } from '../errors/file/fileErrors';

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { InvalidCalevaPackageVersion, InvalidNewVersionError, InvalidUpdateZipNameError, InvalidUpdateZipNameVersionError, TargetUpdateLocationNotDefinedError, TargetUpdateLocationNotValidError, UpdateAlreadyPendingError, VersionStorageLocationNotDefinedError, VersionStorageLocationNotFoundError } from '../errors/update/updateErrors';


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

describe('deleteFile', () => {
    let tempDir: string;

    const originalEnv = process.env.FILE_STORAGE_PATH;

    beforeEach(async () => {
        //Create a unique temp directory for each test
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-'));
        process.env.FILE_STORAGE_PATH = tempDir;
    });


    afterEach(async () => {
        //Clean up temp dir after each test
        await fs.rm(tempDir, { recursive: true, force: true });
        //Restore after each test
        process.env.FILE_STORAGE_PATH = originalEnv;
    });

    it("should delete a file", async () => {

        //Create a test file
        const fileName = "test.txt";
        const fileContent = "hello"
        await fs.writeFile(path.join(tempDir, fileName), fileContent);

        //Get files
        const result = await fileService.deleteFile(fileName);

        //Check results
        expect(result).toBe(true);
    });


    it("should throw NotAFileError for invalid file", async () => {
        await fs.mkdir(path.join(tempDir, "folderpath"));
        await expect(fileService.deleteFile('folderpath'))
            .rejects.toThrow(NotAFileError);
    });

    it("should throw InvalidPathError for invalid path (walking)", async () => {
        await fs.mkdir(path.join(tempDir, "folderpath"));
        await expect(fileService.deleteFile('/nonexistent/path'))
            .rejects.toThrow(InvalidPathError);
    });
});

describe('validateUpdateZipName', () => {
    let tempDir: string;
    let tempVersionLocation: string;

    const originalEnv = process.env.FILE_STORAGE_PATH;
    const originalEnvCalevaVersionLocation = process.env.CALEVA_VERSION_LOCATION;

    beforeEach(async () => {
        //Create a unique temp directory for each test
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-'));
        tempVersionLocation = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-version-'));

        //Create a test package version
        await fs.writeFile(path.join(tempVersionLocation, "packageVersion.json"), JSON.stringify({ packageVersion: "2.35" }));

        process.env.FILE_STORAGE_PATH = tempDir;
        process.env.CALEVA_VERSION_LOCATION = path.join(tempVersionLocation, "packageVersion.json");
    });


    afterEach(async () => {
        //Clean up temp dir after each test
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.rm(tempVersionLocation, { recursive: true, force: true });

        //Restore after each test
        process.env.FILE_STORAGE_PATH = originalEnv;
        process.env.CALEVA_VERSION_LOCATION = originalEnvCalevaVersionLocation
    });


    it("should throw InvalidUpdateZipNameError for invalid version name", async () => {
        await fs.mkdir(path.join(tempDir, "folderpath"));
        await expect(fileService.validateUpdateZipName('aaaaaaa.zip'))
            .rejects.toThrow(InvalidUpdateZipNameError);
    });

    it("should throw InvalidUpdateZipNameVersionError for invalid version name", async () => {
        await fs.mkdir(path.join(tempDir, "folderpath"));
        await expect(fileService.validateUpdateZipName('updateX.XX.zip'))
            .rejects.toThrow(InvalidUpdateZipNameVersionError);
    });


    it("should throw VersionStorageLocationNotDefinedError when not set", async () => {

        delete process.env.CALEVA_VERSION_LOCATION;

        await expect(fileService.validateUpdateZipName('update2.00.zip'))
            .rejects.toThrow(VersionStorageLocationNotDefinedError);
    });

    it("should throw VersionStorageLocationNotDefinedError when not a file", async () => {

        const tempVersionLocation2 = await fs.mkdtemp(path.join(tempVersionLocation, "test"));
        process.env.CALEVA_VERSION_LOCATION = tempVersionLocation2;

        await expect(fileService.validateUpdateZipName('update2.00.zip'))
            .rejects.toThrow(VersionStorageLocationNotFoundError);
    });

    it("should throw InvalidCalevaPackageVersion when version file not the correct format", async () => {

        //Test that the format is respected
        await fs.writeFile(path.join(tempVersionLocation, "nope.json"), JSON.stringify({ vvvvv: "AAAA" }));
        process.env.CALEVA_VERSION_LOCATION = path.join(tempVersionLocation, "nope.json");
        await expect(fileService.validateUpdateZipName('update2.00.zip'))
            .rejects.toThrow(InvalidCalevaPackageVersion);


        //And that the version is correct format
        await fs.writeFile(path.join(tempVersionLocation, "packageVersion.json"), JSON.stringify({ packageVersion: "aaaa" }));
        process.env.CALEVA_VERSION_LOCATION = path.join(tempVersionLocation, "packageVersion.json");
        await expect(fileService.validateUpdateZipName('update2.00.zip'))
            .rejects.toThrow(InvalidCalevaPackageVersion);

    });

    it("should throw InvalidNewVersionError when NOT newer than existing verison", async () => {

        //Test that the format is respected
        await fs.writeFile(path.join(tempVersionLocation, "packageVersion.json"), JSON.stringify({ packageVersion: "2.36" }));

        process.env.CALEVA_VERSION_LOCATION = path.join(tempVersionLocation, "packageVersion.json");
        await expect(fileService.validateUpdateZipName('update2.35.zip'))
            .rejects.toThrow(InvalidNewVersionError);


    });

    it("should return true when valid", async () => {
        const { currentVersion, valid } = await fileService.validateUpdateZipName('update2.36.zip');
        expect(valid).toBe(true);
        expect(currentVersion).toBeDefined();
        expect(currentVersion).toBe("2.35");
    });


});


describe('hasUpdateFilePending > validateNewVersionLocation', () => {
    let tempDir: string;
    let tempNewVersionLocation: string;

    const originalEnv = process.env.FILE_STORAGE_PATH;
    const originalEnvCalevaNewVersionLocation = process.env.CALEVA_NEW_VERSION_LOCATION;

    beforeEach(async () => {
        //Create a unique temp NEW UPDATE directory for each test
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-'));
        tempNewVersionLocation = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-version-NEW-'));

        process.env.FILE_STORAGE_PATH = tempDir;
        process.env.CALEVA_NEW_VERSION_LOCATION = path.join(tempNewVersionLocation);
    });


    afterEach(async () => {
        //Clean up temp dir after each test
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.rm(tempNewVersionLocation, { recursive: true, force: true });

        //Restore after each test
        process.env.FILE_STORAGE_PATH = originalEnv;
        process.env.CALEVA_NEW_VERSION_LOCATION = originalEnvCalevaNewVersionLocation
    });


    it("should throw TargetUpdateLocationNotDefinedError for when location not specified", async () => {

        delete process.env.CALEVA_NEW_VERSION_LOCATION

        await expect(fileService.hasUpdateFilePending())
            .rejects.toThrow(TargetUpdateLocationNotDefinedError);
    });

    it("should throw UpdateAlreadyPendingError for when file already exists", async () => {

        const tPath = path.join(tempNewVersionLocation, "NOTADIRECTORY.zip");
        await fs.writeFile(tPath, "content");        


        const { file, pending } = await fileService.hasUpdateFilePending();

        expect(pending).toBe(true);
        expect(file).toBeDefined();
    });

    it("should throw TargetUpdateLocationNotValidError for when location not a directory", async () => {

        const tPath = path.join(tempNewVersionLocation, "NOTADIRECTORY.txt");
        await fs.writeFile(tPath, "content");
        process.env.CALEVA_NEW_VERSION_LOCATION = tPath;

        await expect(fileService.hasUpdateFilePending())
            .rejects.toThrow(TargetUpdateLocationNotValidError);
    });

    it("should return good values when no update pending", async () => {      

        const { file, pending } = await fileService.hasUpdateFilePending();

        expect(pending).toBe(false);
        expect(file).toBe(null);
            
    });



});