import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import generatedValidator from '../src/validation/fragmentTemplate.validator.generated.js';
import { FragmentTemplateSchema } from '../src/validation/schemas.js';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('generated fragment template validator', () => {
    it('is up to date', () => {
        expect(() =>
            execFileSync(process.execPath, ['./scripts/generate-template-validator.mjs', '--check'], {
                cwd: packageDirectory,
                stdio: 'pipe',
            }),
        ).not.toThrow();
    });

    it('runs when string code generation is disabled', () => {
        const validatorUrl = pathToFileURL(
            resolve(packageDirectory, 'src/validation/fragmentTemplate.validator.generated.js'),
        ).href;
        const script = `
            import validate from ${JSON.stringify(validatorUrl)};
            if (!validate({ sections: [] })) process.exit(1);
            if (validate({ sections: [{ title: 'Missing key', fields: [{ label: 'Name' }] }] })) process.exit(2);
        `;

        expect(() =>
            execFileSync(
                process.execPath,
                ['--disallow-code-generation-from-strings', '--input-type=module', '-e', script],
                {
                    cwd: packageDirectory,
                    stdio: 'pipe',
                },
            ),
        ).not.toThrow();
    });

    it('matches runtime AJV validation results and errors', () => {
        const runtimeValidator = new Ajv({ allErrors: true, verbose: true }).compile(FragmentTemplateSchema);
        const templates: unknown[] = [
            { sections: [] },
            { sections: [{ title: 'Identity', fields: [{ label: 'Name', key: 'name' }] }] },
            { sections: [{ title: 'Missing key', fields: [{ label: 'Name' }] }] },
            { sections: [{ title: 'Bad enum', fields: [{ label: 'Name', key: 'name', format: 'invalid' }] }] },
            { sections: [], unexpected: true },
            null,
        ];

        for (const template of templates) {
            expect(generatedValidator(template)).toBe(runtimeValidator(template));
            expect(generatedValidator.errors).toEqual(runtimeValidator.errors);
        }
    });
});
