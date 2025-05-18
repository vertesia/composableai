import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginImport from 'eslint-plugin-import';

/** @type {import("eslint").Linter.Config[]} */
export default [
    {
        files: ['src/**/*.{ts,tsx}'],
    },
    // Base ESLint recommended rules
    js.configs.recommended,

    // // TypeScript ESLint recommended rules
    ...tseslint.configs.recommended,

    // React and hooks rules
    {
        plugins: {
            react: pluginReact,
            'react-hooks': pluginReactHooks,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            ...pluginReact.configs.recommended.rules,
            ...pluginReactHooks.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off', // React 17+
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },

    {
        rules: {
            'prefer-const': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            "no-unused-expressions": "off",
            '@typescript-eslint/no-unused-expressions': ['error', {
                allowShortCircuit: true,
                allowTernary: true,
                allowTaggedTemplates: true
            }]

        }
    },

    // TypeScript-specific rule overrides
    {
        rules: {
            '@typescript-eslint/explicit-module-boundary-types': 'off',
        },
    },

    // Import plugin rules
    {
        plugins: {
            import: pluginImport,
        },
        rules: {
            ...pluginImport.configs.recommended.rules,
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                    alwaysTryTypes: true,
                    extensions: ['.ts', '.tsx']
                },
            },
        },
    },

    // 🔒 Restrict upward relative imports between feature folders
    {
        files: ['src/core/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../widgets/*', '../router/*', '../session/*', '../features/*'] },
            ],
        },
    },
    {
        files: ['src/session/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../widgets/*', '../router/*', '../core/*', '../features/*'] },
            ],
        },
    },
    {
        files: ['src/router/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../widgets/*', '../session/*', '../features/*'] },
            ],
        },
    },
    {
        files: ['src/widgets/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../router/*', '../session/*', '../features/*'] },
            ],
        },
    },
    {
        files: ['src/features/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../session/*', '../router/*', '../widgets/*'] },
            ],
        },
    },
];