import { Router } from "express";
import { deleteFile, downloadFile, getFiles } from "../controllers/files.controller";
const router = Router();

//Get all files, photos and folders
router.get("/", getFiles);

//Download a file
router.get("/download/:filename", downloadFile);


router.delete("/:filename", deleteFile);

export default router;