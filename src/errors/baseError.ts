export class BaseError extends Error {
    code: string;
    friendlyMessage: string;
    statusCode: number;

    constructor(message: string, code: string, friendlyMessage: string) {

        // Technical message for logs
        super(message);
        this.code = code;

        // User-facing message
        this.friendlyMessage = friendlyMessage;
        this.name = this.constructor.name;
        this.statusCode = 500;

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }
}