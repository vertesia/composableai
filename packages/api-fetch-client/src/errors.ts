function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

function getDetails(payload: unknown): unknown {
    if (!isRecord(payload)) {
        return undefined;
    }
    if (payload.details) {
        return payload.details;
    }
    return isRecord(payload.error) ? payload.error.details : undefined;
}

function createMessage(message: string, request: Request, status: number, payload: unknown, displayDetails: boolean) {
    let msg = message;
    if (displayDetails) {
        msg += `\nRequest: ${request.method} ${request.url} => ${status}`;
        const details = getDetails(payload);
        if (details) {
            const detailsType = typeof details;
            if (detailsType === 'string') {
                msg += `\nDetails: ${details}`;
            } else if (detailsType === 'object') {
                msg += `\nDetails: ${JSON.stringify(details, undefined, 2)}`;
            }
        }
        msg += '\nStack Trace: ';
    }
    return msg;
}

export class RequestError extends Error {
    status: number;
    payload: unknown;
    request: Request;
    request_info: string;
    displayDetails: boolean;
    original_message: string;
    constructor(message: string, request: Request, status: number, payload: unknown, displayDetails = true) {
        super(createMessage(message, request, status, payload, displayDetails));
        this.original_message = message;
        this.request = request;
        this.status = status;
        this.payload = payload;
        this.request_info = `${request.method} ${request.url} => ${status}`;
        this.displayDetails = displayDetails;
    }

    get details() {
        return getDetails(this.payload);
    }
}

export class ServerError extends RequestError {
    constructor(message: string, req: Request, status: number, payload: unknown, displayDetails = true) {
        super(message, req, status, payload, displayDetails);
    }

    updateDetails(details: unknown) {
        if (details !== this.details) {
            const payload = isRecord(this.payload) ? { ...this.payload, details } : { details };
            return new ServerError(this.original_message, this.request, this.status, payload, this.displayDetails);
        } else {
            return this;
        }
    }
}

export class ConnectionError extends RequestError {
    constructor(req: Request, err: Error) {
        super(`Failed to connect to server: ${err.message}`, req, 0, err);
    }
}
