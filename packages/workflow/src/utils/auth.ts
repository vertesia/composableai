import { AuthTokenPayload, ProjectRef } from '@vertesia/common';
import jwt from 'jsonwebtoken';

export function decodeAuthToken(token: string): AuthTokenPayload {
    return jwt.decode(token, { json: true }) as AuthTokenPayload;
}

export function getProjectFromToken(token: string): ProjectRef | undefined {
    return decodeAuthToken(token)?.project;
}
