import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getFiles, downloadFile } from './files.controller';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('files.controller', () => {

    let app: express.Express;
    let tempDir: string;

    beforeEach(() => {
        console.log('FILE_STORAGE_PATH:', process.env.FILE_STORAGE_PATH);
    })

    beforeEach(async () => {

        //Create a directory on each call
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'controller-test-'));
        process.env.FILE_STORAGE_PATH = tempDir;

        //Wire up the app
        app = express();
        app.get('/files', getFiles);
        app.get('/files/:filename', downloadFile);


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

    it('GET /files/:filename with traversal attempt returns error', async () => {
        const res = await request(app).get('/files/..%2F..%2Fetc%2Fpasswd');
        expect(res.status).toBe(400);
    });

    it('GET /files/:filename downloads a file', async () => {

        //Create a test file
        await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

        const res = await request(app).get('/files/test.txt');

        expect(res.status).toBe(200);
    });
});