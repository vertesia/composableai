/**
 * Example usage of InteractionOutput
 * This file demonstrates the Proxy-based approach where the result acts as both
 * an array and has convenience methods.
 */

import { CompletionResult } from '@llumiverse/common';
import { InteractionOutput } from './ExecutionResult.js';

// Sample data
const sampleResults: CompletionResult[] = [
    { type: 'text', value: 'Hello, ' },
    { type: 'text', value: 'World!' },
    { type: 'json', value: { name: 'Alice', age: 30 } },
    { type: 'json', value: { title: 'Engineer', level: 'Senior' } },
    { type: 'image', value: 'data:image/png;base64,iVBORw0K...' }
];

// Example 1: Using InteractionOutput.from() (Proxy approach - RECOMMENDED)
console.log('=== Example 1: Proxy Approach ===');
interface Person { name: string; age: number; }
const output = InteractionOutput.from<Person>(sampleResults);

// Works as an array
console.log('Array length:', output.length);           // 5
console.log('First item:', output[0]);                 // { type: 'text', value: 'Hello, ' }
console.log('Types:', output.map(r => r.type));        // ['text', 'text', 'json', 'json', 'image']

// Has convenience methods
console.log('All text:', output.text);                 // 'Hello, World!'
console.log('First object:', output.object());         // { name: 'Alice', age: 30 } (typed as Person)
console.log('All objects:', output.objects());         // [{ name: 'Alice', age: 30 }, { title: 'Engineer', level: 'Senior' }]
console.log('First image:', output.image);             // 'data:image/png;base64,iVBORw0K...'

// Override type for specific objects
interface Job { title: string; level: string; }
console.log('Second object:', output.objectAt<Job>(1)); // { title: 'Engineer', level: 'Senior' } (typed as Job)

// Example 2: Using InteractionOutput class directly
console.log('\n=== Example 2: Class Approach ===');
const wrapper = new InteractionOutput<Person>(sampleResults);

// Access through wrapper properties (no array access)
console.log('All text:', wrapper.text);
console.log('Raw results:', wrapper.results);          // Original array
console.log('First object:', wrapper.object());

// Example 3: Type safety demonstration
console.log('\n=== Example 3: Type Safety ===');

interface Contract { title: string; parties: string[]; }
const contractResults: CompletionResult[] = [
    { type: 'json', value: { title: 'Sales Agreement', parties: ['Alice', 'Bob'] } }
];

const contractOutput = InteractionOutput.from<Contract>(contractResults);
const contract = contractOutput.object(); // TypeScript knows this is Contract
console.log('Contract title:', contract.title);
console.log('Parties:', contract.parties.join(', '));

// Example 4: Mixed content
console.log('\n=== Example 4: Mixed Content ===');
const mixedResults: CompletionResult[] = [
    { type: 'text', value: 'Analysis complete. Results: ' },
    { type: 'json', value: { score: 0.95, confidence: 'high' } },
    { type: 'text', value: '\nThank you!' }
];

const mixed = InteractionOutput.from(mixedResults);
console.log('Full text:', mixed.text);                 // 'Analysis complete. Results: \nThank you!'
console.log('Analysis:', mixed.object());              // { score: 0.95, confidence: 'high' }
console.log('Text parts:', mixed.texts);               // ['Analysis complete. Results: ', '\nThank you!']
