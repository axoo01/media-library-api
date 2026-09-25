import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'uploads/', 'coverage/', 'src/generated/'] },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      // Lab rule: async/await only — forbid .then() / .catch() promise chains.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^(then|catch)$/]',
          message: 'Use async/await with try/catch instead of .then()/.catch() chains.',
        },
      ],
    },
  },

  // The logger is the only module allowed to write to the console.
  {
    files: ['src/utils/logger.js'],
    rules: { 'no-console': 'off' },
  },

  // Must be last: turns off stylistic rules that conflict with Prettier.
  prettierConfig,
];
