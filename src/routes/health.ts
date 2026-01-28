import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import * as fileService from "../services/file.service";

const router = Router();

router.get("/", async (_req, res) => {
  //get locked status

  //Grab location from env
  const storageLocation = fileService.getStorageLocation();

  const lockedStatus = await fs
    .readFile(
      path.join(storageLocation, "machine-lock", "MACHINELOCK.JSON"),
      "utf-8",
    )
    .then((r) => JSON.parse(r) as { isLocked: boolean })
    .catch(() => ({ isLocked: false }));

  res.json({
    ok: true,
    service: "caleva-data-api",
    time: new Date().toISOString(),
    locked: lockedStatus.isLocked,
  });
});

export default router;
