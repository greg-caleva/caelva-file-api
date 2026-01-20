import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getFiles, downloadFile } from './files.controller';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('files.controller', () => {

    //Scaffolded express
    let app: express.Express;

    //Temp file base
    let tempDir: string;

    beforeEach(async () => {

        //Create a directory on each call
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'controller-test-'));
        process.env.FILE_STORAGE_PATH = tempDir;

        //Wire up the app
        app = express();
        app.get('/files', getFiles);
        app.get('/files/:filename', downloadFile);

        console.log('using FILE_STORAGE_PATH:', process.env.FILE_STORAGE_PATH);
    });

    afterEach(async () => {
        //Clear up the directory on after each
        await fs.rm(tempDir, { recursive: true, force: true });
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
});