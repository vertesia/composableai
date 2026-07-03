import { describe, expect, test } from 'vitest';
//import util from 'util';
import { validate } from '../src/validation.js';
import { readDataFile } from './utils.js';

// function log(obj: any) {
//     console.log(util.inspect(obj, false, null, true /* enable colors */))
// }

const script1 = readDataFile('script1.js');

describe('Validation', () => {
    //log(result.node)
    test('built-in guard works', () => {
        const result = validate(script1, {
            acorn: {
                allowReturnOutsideFunction: true,
                locations: true,
            },
            globals: ['console'],
        });
        //result.errors.map(error => `${error.message} at ${error.location}`).forEach((line) => console.log(line));
        expect(result.errors.length).toBe(10);
    });
});
