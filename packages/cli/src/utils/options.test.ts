import { describe, expect, it } from 'vitest';
import { errorMessage, redactCliSecrets } from './options.js';

describe('CLI error formatting', () => {
    it('prints an Error message without inspecting attached request headers', () => {
        const error = Object.assign(new Error('Request failed'), {
            request: { headers: { authorization: 'Bearer secret-token' } },
        });

        expect(errorMessage(error)).toBe('Request failed');
    });

    it('redacts bearer credentials and URL userinfo from string errors', () => {
        expect(redactCliSecrets('authorization: Bearer secret.token and https://token-value@example.test/repo')).toBe(
            'authorization: Bearer [REDACTED] and https://[REDACTED]@example.test/repo',
        );
    });
});
