import { validateTemplate } from '../lib/validation/validateTemplate.js';

const validResult = validateTemplate({ sections: [{ title: 'Identity', fields: [{ label: 'Name', key: 'name' }] }] }, [
    'name',
]);
if (!validResult.valid) {
    throw new Error('Built validator rejected a valid template.');
}

const invalidResult = validateTemplate({ sections: [{ title: 'Identity', fields: [{ label: 'Name' }] }] }, ['name']);
if (invalidResult.valid || !invalidResult.errors.some((error) => error.message.includes('key'))) {
    throw new Error('Built validator accepted an invalid template.');
}
