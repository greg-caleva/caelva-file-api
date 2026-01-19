import type { Request, Response, NextFunction } from "express";

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error(err);

    res.status(500).json({
        ok: false,
        error: "Internal Server Error",
        message,
    });
}