import { BaseError } from "../baseError";

export class StorageLocationNotDefinedError extends BaseError {
    constructor() {
        super(
            'Storage location not defined',
            'STORAGE_LOCATION_NOT_DEFINED',
            'The storage location has not been set/defined in config.'
        );
        this.statusCode = 400;
    }
}

export class DirectoryNotFoundError extends BaseError {
    constructor() {
        super(
            'Storage directory not found',
            'STORAGE_LOCATION_NOT_FOUND',
            'The storage location was not found.'
        );
        this.statusCode = 400;
    }
}

export class InvalidFileNameError extends BaseError {
    constructor() {
        super(
            'Invalid File Name',
            'INVALID_FILE_NAME',
            'The provided file name is invalid.'
        );
        this.statusCode = 400;
    }
}

export class InvalidPathError extends BaseError {
    constructor() {
        super(
            'Invalid Path',
            'INVALID_PATH_NAME',
            'The provided path name is invalid.'
        );
        this.statusCode = 400;
    }
}

export class NotAFileError extends BaseError {
    constructor() {
        super(
            'Not a file',
            'NOT_A_FILE',
            'The requested file is not a file.'
        );
        this.statusCode = 400;
    }
}
