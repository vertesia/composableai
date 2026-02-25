import js from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { fixupPluginRules } from '@eslint/compat';

/** @type {import("eslint").Linter.Config[]} */
export default [
    {
        files: ['src/**/*.{ts,tsx}'],
    },
    // Base ESLint recommended rules
    js.configs.recommended,

    // // TypeScript ESLint recommended rules
    ...tseslint.configs.recommended,

    // TypeScript parser configuration
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                allowDefaultProject: ['*.js', '*.mjs'],
            },
        },
    },

    // React and hooks rules
    {
        plugins: {
            react: fixupPluginRules(pluginReact),
            'react-hooks': fixupPluginRules(pluginReactHooks),
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
            'react/prop-types': 'off', // not needed with TypeScript
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
            '@typescript-eslint/no-unused-expressions': ['error', {
                allowShortCircuit: true,
                allowTernary: true,
            }],

            //TODO review the following rules
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-wrapper-object-types": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "react-hooks/exhaustive-deps": "off",
            "import/no-unresolved": "off",
            "no-empty-pattern": "off",
            "react/display-name": "off",
            "react/no-unknown-property": "off",
        },
    },

    // Import plugin rules
    {
        plugins: {
            import: fixupPluginRules(pluginImport),
        },
        rules: {
            ...pluginImport.configs.recommended.rules,
            'import/no-unresolved': 'off',
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
                { patterns: ['../widgets/*', '../router/*', '../session/*', '../features/*', '../layout/*', '../env/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/session/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../widgets/*', '../router/*', '../core/*', '../features/*', '../layout/*', '../env/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/router/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../widgets/*', '../session/*', '../features/*', '../layout/*', '../env/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/widgets/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../router/*', '../session/*', '../features/*', '../layout/*', '../env/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/features/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../session/*', '../router/*', '../widgets/*', '../layout/*', '../env/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/layout/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../session/*', '../router/*', '../widgets/*', '../features/*', '../env/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/env/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../session/*', '../router/*', '../widgets/*', '../features/*', '../layout/*', '../shell/*'] },
            ],
        },
    },
    {
        files: ['src/shell/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['../core/*', '../session/*', '../router/*', '../widgets/*', '../features/*', '../layout/*', '../env/*'] },
            ],
        },
    },
];