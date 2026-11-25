export class ValidationError extends Error {
    constructor(message: string) {
        super(`Invalid workflow definition: ${message}`);
        this.name = 'ValidationError';
    }
}
