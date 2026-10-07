// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '.cloude/**',
    '**/src/generated/**',
  ]),

  js.configs.recommended,

  // Type-aware rules for all TypeScript sources (each file belongs to some tsconfig).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Plain JS config files: no type information.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Backend (NestJS, Node)
  {
    files: ['apps/backend/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      // Nest relies on runtime class references for DI (emitDecoratorMetadata),
      // so type-only imports of injectables would break injection.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // Nest modules are classes with decorators only.
    files: ['apps/backend/**/*.module.ts'],
    rules: { '@typescript-eslint/no-extraneous-class': 'off' },
  },

  // Shared package
  {
    files: ['packages/shared/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },

  // Frontend (React, browser)
  {
    files: ['apps/frontend/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      // react-hook-form's handleSubmit returns a promise by design; JSX event attributes ignore it.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ['apps/frontend/e2e/**/*.ts', 'apps/frontend/*.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Must be last: turns off rules that conflict with Prettier formatting.
  prettier,
]);
