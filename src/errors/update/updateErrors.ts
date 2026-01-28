import { BaseError } from "../baseError";

export class InvalidUpdateZipNameError extends BaseError {
    constructor() {
        super(
            'Invalid Update Zip Name',
            'INVALID_UPDATE_ZIP_NAME',
            'The name of the update zip file is not valid.'
        );
        this.statusCode = 400;
    }
}

export class InvalidUpdateZipNameVersionError extends BaseError {
    constructor() {
        super(
            'Invalid Update Zip Name',
            'INVALID_UPDATE_ZIP_NAME_VERSION',
            'The name of the update zip file is not valid.'
        );
        this.statusCode = 400;
    }
}

export class VersionStorageLocationNotDefinedError extends BaseError {
    constructor() {
        super(
            'Version storage location not defined',
            'VERSION_STORAGE_LOCATION_NOT_DEFINED',
            'The version storage location has not been set/defined in config.'
        );
        this.statusCode = 400;
    }
}

export class VersionStorageLocationNotFoundError extends BaseError {
    constructor() {
        super(
            'Version storage location not found',
            'VERSION_STORAGE_LOCATION_NOT_FOUND',
            'The version storage location was not found.'
        );
        this.statusCode = 400;
    }
}


export class InvalidCalevaPackageVersion extends BaseError {
    constructor() {
        super(
            'Version storage package invalid',
            'VERSION_STORAGE_PACKAGE_INVALID',
            'The version storage package was invalid.'
        );
        this.statusCode = 400;
    }
}

export class InvalidNewVersionError extends BaseError {
    constructor() {
        super(
            'Invalid new version',
            'INVALID_NEW_VERSION',
            'The new version is not newer than the current version.'
        );
        this.statusCode = 400;
    }
}

export class TargetUpdateLocationNotDefinedError extends BaseError {
    constructor() {
        super(
            'Target update location was not defined.',
            'TARGET_UPDATE_LOCATION_NOT_DEFINED',
            'The target update location was not defined in config.'
        );
        this.statusCode = 400;
    }
}

export class TargetUpdateLocationNotValidError extends BaseError {
    constructor() {
        super(
            'Target update location was not valid.',
            'TARGET_UPDATE_LOCATION_NOT_VALID',
            'The target update location was not valid (likely not a folder).'
        );
        this.statusCode = 400;
    }
}

export class UpdateAlreadyPendingError extends BaseError {
    constructor() {
        super(
            'Update already penidng.',
            'UPDATE_ALREADY_PENDING',
            'The system already has an update already pending'
        );
        this.statusCode = 400;
    }
}