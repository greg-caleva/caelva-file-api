import { Router } from "express";
import { downloadFile, getFiles } from "../controllers/files.controller";
const router = Router();

//Get all files, photos and folders
router.get("/", getFiles);

//Download a file
router.get("/download/:filename", downloadFile);
export default router;