import dotenv from "dotenv";
dotenv.config();

import fs from "fs";

import type { Request, Response, NextFunction } from "express";

export function logRequest(req: Request, res: Response, _next: NextFunction) {

    if(req.path === '/health') {
        return _next();
    }

    const logLocation = `${process.env.FILE_STORAGE_PATH}/requests.log`
    const MAX_LINES = 5000;

    //Check and create log file if it doesn't exist
    const log_exists = fs.existsSync(logLocation);
    if (!log_exists) {
        fs.writeFileSync(logLocation, '');
    }

    try {

        //Create log entry
        const logEntry = `${new Date().toISOString()} - ${req.method} ${req.path} - FROM IP: ${req.ip}`;

        // Read existing content
        let content = '';
        content = fs.readFileSync(logLocation, 'utf8');

        // Split into lines and append new entry
        let lines = content ? content.split('\n') : [];
        lines.push(logEntry);

        // Keep only last 5000 lines
        if (lines.length > MAX_LINES) {
            lines = lines.slice(-MAX_LINES);
        }

        // Write back to file
        fs.writeFileSync(logLocation, lines.join('\n'), 'utf8');

    } catch (err) {
        //Cath errors silently
        console.error('Error writing to log:', err);        
    }

    return _next();
}