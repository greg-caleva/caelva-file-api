import { Router } from "express";
import { deleteFile, downloadFile, getFiles, uploadUpdateFile, hasUpdateFilePending, deletePendingUpdate } from "../controllers/files.controller";
import multer from "multer";
import os from "os";
const router = Router();

//Get all files, photos and folders
router.get("/", getFiles);

//Download a file
router.get("/download/:filename", downloadFile);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, os.tmpdir())
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

router.post("/update", upload.single("upload"), uploadUpdateFile)
router.delete("/:filename", deleteFile);

router.get("/update/pending", hasUpdateFilePending)
router.delete("/update/pending", deletePendingUpdate)

export default router;