import { DirectoryNotFoundError, StorageLocationNotDefinedError } from "../errors/file/fileErrors";
import path from "path";
import fs from "fs/promises";
import { File } from "../dto/file.dto";
import { Dirent } from "fs";

export const getStorageLocation = () => {
    //Grab location from env
    const storageLocation = process.env.FILE_STORAGE_PATH;

    //Ensure we have the storage location set
    if (!storageLocation) {
        throw new StorageLocationNotDefinedError();
    }

    return storageLocation;
}

export const getFiles = async (location: string) => {

    let entries: Dirent[] = [];

    try {
        //Read directory entries
        entries = await fs.readdir(location, {
            withFileTypes: true,
        });
    } catch (error) {
        throw new DirectoryNotFoundError();
    }

    //Build file and folder lists with metadata
    const files: File[] = [];
    const folders: string[] = [];

    for (const entry of entries) {

        //If file then get stats of file
        if (entry.isFile()) {
            const stat = await fs.stat(path.join(location, entry.name));

            //And add to array
            files.push({
                name: entry.name,
                size: stat.size,
                isFile: true,
                isPhoto: false
            });
        } else if (entry.isDirectory()) {
            //Check if this is a photos folder
            if (entry.name.endsWith("-photos")) {

                //Get the path by joining with storage path
                const photoFolderPath = path.join(location, entry.name);

                //Read the photos folder
                const photoEntries = await fs.readdir(photoFolderPath, { withFileTypes: true });

                //Get the prefix (folder name without -photos suffix)
                const prefix = entry.name.slice(0, -7); // Remove "-photos"

                //Loop through photos
                for (const photoEntry of photoEntries) {

                    //Check entry is a file
                    if (photoEntry.isFile()) {

                        //Get photo stats
                        const photoStat = await fs.stat(path.join(photoFolderPath, photoEntry.name));
                        const ext = path.extname(photoEntry.name);
                        const baseName = path.basename(photoEntry.name, ext);

                        //Add the file keeping the original path
                        files.push({
                            name: `${prefix}-photo-${baseName}${ext}`,
                            size: photoStat.size,
                            isPhoto: true,
                            originalPath: `${entry.name}/${photoEntry.name}`,
                            isFile: true
                        });
                    }
                }
            } else {
                //For any other folders, just push the name
                folders.push(entry.name);
            }
        }
    }
    return { files, folders }

}