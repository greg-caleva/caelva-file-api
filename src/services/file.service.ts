import { DirectoryNotFoundError, InvalidFileNameError, InvalidPathError, NotAFileError, StorageLocationNotDefinedError } from "../errors/file/fileErrors";
import path from "path";
import fs from "fs/promises";
import { Dirent } from "fs";
import { InvalidCalevaPackageVersion, InvalidNewVersionError, InvalidUpdateZipNameError, InvalidUpdateZipNameVersionError, TargetUpdateLocationNotDefinedError, TargetUpdateLocationNotValidError, UpdateAlreadyPendingError, VersionStorageLocationNotDefinedError, VersionStorageLocationNotFoundError } from "../errors/update/updateErrors";
import { File } from "../dto/file.dto";


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

export const deleteFile = async (filename: string) => {
    //Early validation

    if (!filename || filename.length > 255) {
        throw new InvalidFileNameError();
    }

    const storageLocation = getStorageLocation();

    let base = "";
    let fullPath = "";

    try {
        //Resolve + normalize to prevent traversal
        base = path.resolve(storageLocation);
        fullPath = path.resolve(base, filename);
    } catch (error) {
        throw new InvalidPathError();
    }
    if (!fullPath.startsWith(base + path.sep)) {
        throw new InvalidPathError();
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
        throw new NotAFileError();
    }

    await fs.rm(fullPath);
    return true;
}



const getVersionFile = async () => {

    const versionFile = process.env.CALEVA_VERSION_LOCATION;

    //Ensure we have the storage location set
    if (!versionFile) {
        throw new VersionStorageLocationNotDefinedError();
    }

    const found = await fs.stat(versionFile);
    if (!found.isFile()) {
        throw new VersionStorageLocationNotFoundError();
    }


    return versionFile;
}

const getCurrentPackageVersion = async (packageFilename: string) => {

    try {
        const fileContents = await fs.readFile(packageFilename, "utf-8");
        const parsed = JSON.parse(fileContents) as { packageVersion: string };

        const versionNumber = validVersionNumber(parsed.packageVersion);

        return versionNumber;
    } catch (error) {
        throw new InvalidCalevaPackageVersion();
    }
}

const validVersionNumber = (version: string) => {
    const found = /[2-9].[0-9][0-9]/g.test(version);
    if (!found) {
        throw new InvalidCalevaPackageVersion();
    }

    return version;
}


const validateNewVersionLocation = async () => {

    const targetLocation = process.env.CALEVA_NEW_VERSION_LOCATION;
    if (targetLocation === undefined) {
        throw new TargetUpdateLocationNotDefinedError();
    }

    const targetDirectory = await fs.stat(targetLocation);
    if (!targetDirectory.isDirectory()) {
        throw new TargetUpdateLocationNotValidError();
    }

    return { target: targetLocation }

}


export const validateUpdateZipName = async (zipName: string) => {

    //Check zip starts with update
    const safename = zipName.toLowerCase();
    if (!safename.startsWith("update")) {
        throw new InvalidUpdateZipNameError();
    }

    //At this point, we should have a version number
    const extractedVersion = safename.replace("update", "").replace(".zip", "");

    const found = /[2-9].[0-9][0-9]/g.test(extractedVersion);
    if (!found) {
        throw new InvalidUpdateZipNameVersionError();
    }

    const location = await getVersionFile();
    const currentVersion = await getCurrentPackageVersion(location);

    //Test is newer
    const newVersionNumber = parseInt(extractedVersion.replace(".", ""))
    const currentVersionNumber = parseInt(currentVersion.replace(".", ""))

    if (newVersionNumber <= currentVersionNumber) {
        throw new InvalidNewVersionError();
    }

    return { currentVersion: currentVersion, valid: true, newVersion: extractedVersion };

}


export const uploadUpdateFile = async (sourcePath: string, targetFilename: string) => {
    const hasPending = await hasUpdateFilePending();
    if (hasPending.pending) {
        throw new UpdateAlreadyPendingError();
    }

    const { target } = await validateNewVersionLocation();

    await fs.copyFile(sourcePath, path.join(target, targetFilename));
}

export const hasUpdateFilePending = async () => {
    const { target } = await validateNewVersionLocation();

    const files = await fs.readdir(target);

    return { file: files[0] || null, pending: files.length > 0};
}

export const deletePendingUpdate = async () => {
    const { target } = await validateNewVersionLocation();

    const files = await fs.readdir(target);
    for (let index = 0; index < files.length; index++) {
        const updateFile = files[index];
        await fs.rm(path.join(target, updateFile));
    }

    return files;
}