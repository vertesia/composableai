import { type CustomRoleDefinition, Permission } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { createAccountRoleResolver, getRoleByName, InvalidCustomRoleError } from './index.js';

function definition(name: string, base_roles: string[] = [], permissions: Permission[] = []): CustomRoleDefinition {
    return { name, title: name, base_roles, permissions };
}

describe('custom role inheritance', () => {
    it('unions system bases, custom bases and explicit additions without changing the role name', () => {
        const resolve = createAccountRoleResolver([
            definition('reviewer', ['auditor'], [Permission.content_write]),
            definition('editor', ['c:reviewer'], [Permission.content_delete]),
        ]);
        const editor = resolve('c:editor');
        expect(editor.name).toBe('c:editor');
        expect(editor.permissions).toEqual(
            new Set([...getRoleByName('auditor').permissions, Permission.content_write, Permission.content_delete]),
        );
        expect(resolve('c:editor')).toBe(editor);
        expect(getRoleByName('auditor').permissions.has(Permission.content_write)).toBe(false);
    });

    it('permits diamond inheritance and deduplicates grants', () => {
        const resolve = createAccountRoleResolver(
            [
                definition('base', [], [Permission.content_read]),
                definition('left', ['c:base']),
                definition('right', ['c:base']),
                definition('child', ['c:left', 'c:right', 'c:base'], [Permission.content_read]),
            ],
            { strict: true },
        );
        expect([...resolve('c:child').permissions]).toEqual([Permission.content_read]);
    });

    it.each([
        [definition('a', ['c:a'])],
        [definition('a', ['c:b']), definition('b', ['c:c']), definition('c', ['c:a'])],
        [definition('a', ['c:missing'], [Permission.content_write])],
        [definition('a', ['content:reader'], [Permission.content_write])],
        [definition('a', ['unknown'], [Permission.content_write])],
    ])('rejects invalid graphs in strict mode and grants nothing at mint: %j', (...definitions) => {
        const resolve = createAccountRoleResolver(definitions);
        const strict = createAccountRoleResolver(definitions, { strict: true });
        for (const { name } of definitions) {
            expect(() => strict(`c:${name}`)).toThrow(InvalidCustomRoleError);
            expect([...resolve(`c:${name}`).permissions]).toEqual([]);
        }
    });

    it('fails closed for the complete dependent role, but leaves unrelated roles usable', () => {
        const resolve = createAccountRoleResolver([
            definition('a', ['c:b']),
            definition('b', ['c:a']),
            definition('child', ['c:a'], [Permission.content_write]),
            definition('valid', [], [Permission.content_read]),
        ]);
        expect([...resolve('c:child').permissions]).toEqual([]);
        expect([...resolve('c:valid').permissions]).toEqual([Permission.content_read]);
        expect(resolve('auditor')).toBe(getRoleByName('auditor'));
    });

    it('does not leak definitions between accounts or mutate a prior snapshot', () => {
        const first = createAccountRoleResolver([
            definition('base', [], [Permission.content_read]),
            definition('child', ['c:base']),
        ]);
        const second = createAccountRoleResolver([
            definition('base', [], [Permission.content_write]),
            definition('child', ['c:base']),
        ]);
        expect([...first('c:child').permissions]).toEqual([Permission.content_read]);
        expect([...second('c:child').permissions]).toEqual([Permission.content_write]);
        expect([...first('c:child').permissions]).toEqual([Permission.content_read]);
    });
});
