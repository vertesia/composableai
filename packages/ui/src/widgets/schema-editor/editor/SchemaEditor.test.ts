import { describe, it, expect } from 'vitest';
import { validatePropertyName } from './SchemaEditor';

describe('validatePropertyName', () => {
    it('should return true for valid property names', () => {
        const validNames = [
            'name',
            'name?',
            '1name',
            '1name?',
            'property1',
            'property1?',
            'valid_name',
            'valid_name?',
            'anotherValidName',
            'anotherValidName?',
        ];
        validNames.forEach(name => {
            const err = validatePropertyName(name);
            expect(err).toBeUndefined();
        });
    });

    it('should return false for invalid property names', () => {
        const invalidNames = [
            'property-1', // dash (-) is not allowed
            'invalid name', // space ( ) is not allowed
            'anotherInvalidName!', // exclamation mark (!) is not allowed
            'invalid?name', // question mark (?) is not allowed in the middle
            'user.name', // dot (.) is not allowed

            // special characters are not allowed
            'name$',
            'property@',
            'invalid#name',
            'another%InvalidName',
        ];
        invalidNames.forEach(name => {
            const err = validatePropertyName(name);
            expect(err).toBe('Only letters, numbers, underscores or question mark are allowed (a-zA-Z0-9_?)');
        });
    });

    it('should return false for empty property name', () => {
        const err = validatePropertyName('')
        expect(err).toBe('Name is required');
    });
});