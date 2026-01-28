import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { getFiles, downloadFile, deleteFile, uploadUpdateFile } from './files.controller';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('files.controller', () => {

    //Scaffolded express
    let app: express.Express;

    //Temp file base
    let tempDir: string;    
    let tempVersionLocation: string;

    const originalEnv = process.env.FILE_STORAGE_PATH;
    const originalEnvCalevaVersionLocation = process.env.CALEVA_VERSION_LOCATION;


    beforeEach(async () => {

        //Create a directory on each call
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'controller-test-'));
        process.env.FILE_STORAGE_PATH = tempDir;

        tempVersionLocation = await fs.mkdtemp(path.join(os.tmpdir(), 'file-service-test-version-'));
        process.env.CALEVA_VERSION_LOCATION = path.join(tempVersionLocation, "packageVersion.json");

        //Create a test package version
        await fs.writeFile(path.join(tempVersionLocation, "packageVersion.json"), JSON.stringify({ packageVersion: "2.35" }));

        //Wire up the app
        app = express();
        const upload = multer({ dest: path.join(tempDir, 'uploads') });
        app.get('/files', getFiles);
        app.get('/files/:filename', downloadFile);
        app.delete('/files/:filename', deleteFile);
        app.post('/files/update/:filename', upload.single('upload'), uploadUpdateFile);

        console.log('using FILE_STORAGE_PATH:', process.env.FILE_STORAGE_PATH);
    });

    afterEach(async () => {
        //Clear up the directory on after each
        await fs.rm(tempDir, { recursive: true, force: true });

        process.env.FILE_STORAGE_PATH = originalEnv;
        process.env.CALEVA_VERSION_LOCATION = originalEnvCalevaVersionLocation;
    });

    it('GET /files returns file list', async () => {

        //Create a test file
        await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

        //Run req
        const res = await request(app).get('/files');

        //Check response
        expect(res.status).toBe(200);
        expect(res.body.fileCount).toBe(1);
    });

    //Check that we can't enumerate invalid locatioins
    it('GET /files/:filename with traversal attempt returns error', async () => {
        const res = await request(app).get('/files/..%2F..%2Fetc%2Fpasswd');
        expect(res.status).toBe(400);
    });

    it('GET /files/:filename downloads a file', async () => {

        //Create a test file
        await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

        //Get file
        const res = await request(app).get('/files/test.txt');

        //Check
        expect(res.status).toBe(200);
    });

    it('DELETE /files/:filename deletes a file', async () => {

        //Create a test file
        await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

        //Get file
        const res = await request(app).delete('/files/test.txt');

        //Check
        expect(res.status).toBe(200);

    });

    it('POST /files/:update/filename uploads an update zip', async () => {

        //Create a test file to upload
        const testFilePath = path.join(tempDir, 'update2.36.zip');
        await fs.writeFile(testFilePath, 'fake zip content');

        //Upload update file
        const res = await request(app)
            .post('/files/update')
            .attach('upload', testFilePath);

        //Check
        expect(res.status).toBe(200);

    });

    it('POST /files/:update/filename returns 400 when zip is not newer', async () => {

        //Create a test file to upload
        const testFilePath = path.join(tempDir, 'update2.00.zip');
        await fs.writeFile(testFilePath, 'fake zip content');

        //Upload update file
        const res = await request(app)
            .post('/files/update')
            .attach('upload', testFilePath);

        //Check
        expect(res.status).toBe(400);

    });

});
