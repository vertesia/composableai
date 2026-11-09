import { describe, expect, it } from 'vitest';
import { isOAuthStatusUnknownError, oauthErrorDetail } from './oauthStatusError.js';

describe('isOAuthStatusUnknownError', () => {
    it.each([500, 502, 503, 504, 429, 0])('treats HTTP %s as no answer about the connection', (status) => {
        expect(isOAuthStatusUnknownError(Object.assign(new Error('failed'), { status }))).toBe(true);
    });

    it('treats an error without a status as no answer', () => {
        expect(isOAuthStatusUnknownError(new TypeError('Failed to fetch'))).toBe(true);
        expect(isOAuthStatusUnknownError(undefined)).toBe(true);
    });

    it.each([400, 401, 403, 404])('treats HTTP %s as an answer', (status) => {
        expect(isOAuthStatusUnknownError(Object.assign(new Error('failed'), { status }))).toBe(false);
    });
});

describe('oauthErrorDetail', () => {
    it('prefers the server answer over the message that carries the request line', () => {
        const error = Object.assign(new Error('Busy\nRequest: POST https://api.example.com => 503'), {
            original_message: 'Busy',
        });
        expect(oauthErrorDetail(error)).toBe('Busy');
    });

    it('drops a leading error type and ignores non-errors', () => {
        expect(oauthErrorDetail(new Error('ServerError: Busy'))).toBe('Busy');
        expect(oauthErrorDetail('Busy')).toBeUndefined();
    });
});
