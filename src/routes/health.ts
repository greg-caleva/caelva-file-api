import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
    res.json({
        ok: true,
        service: "express-api",
        time: new Date().toISOString(),
    });
});

export default router;