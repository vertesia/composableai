import assert from 'node:assert/strict';
import test from 'node:test';
import {
    renderTransformerModule,
    validateBuiltInteractionPrompts,
} from '../../src/modules/service/scripts/build-server-support.mjs';

test('renders transformer data as a default export when no custom code is supplied', () => {
    const source = renderTransformerModule({
        data: { role: 'user', content: 'Create the project.', content_type: 'handlebars' },
    });

    assert.match(source, /^export default \{/);
    assert.match(source, /"content": "Create the project\."/);
});

test('preserves transformer imports and custom code', () => {
    const source = renderTransformerModule({
        data: { ignored: true },
        imports: ["import schema from './schema.js';"],
        code: 'export default { schema };',
    });

    assert.equal(source, "import schema from './schema.js';\n\nexport default { schema };");
});

test('rejects empty prompts in the bundled interaction configuration', () => {
    assert.throws(
        () =>
            validateBuiltInteractionPrompts({
                interactions: [
                    {
                        name: 'main',
                        interactions: [{ name: 'create-project', prompts: [{}] }],
                    },
                ],
            }),
        /main:create-project prompt 0 has no role/,
    );
});

test('accepts complete bundled interaction prompts', () => {
    assert.deepEqual(
        validateBuiltInteractionPrompts({
            interactions: [
                {
                    name: 'main',
                    interactions: [
                        {
                            name: 'create-project',
                            prompts: [{ role: 'user', content: 'Create it.', content_type: 'handlebars' }],
                        },
                    ],
                },
            ],
        }),
        { interactionCount: 1, promptCount: 1 },
    );
});
