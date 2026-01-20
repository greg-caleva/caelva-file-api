import type { Request, Response, NextFunction } from "express";
import { BaseError } from "../errors/baseError";

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    // eslint-disable-next-line no-console
    console.error(err);

    if (err instanceof BaseError) {
        res.status(err.statusCode).json({
            ok: false,
            error: err.code,
            message: err.friendlyMessage,
        });
    } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({
            ok: false,
            error: "Internal Server Error",
            message,
        });
    }
}