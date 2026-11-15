// ESLint: catches mistakes the tests can't see (typos in names, unused code, code that never runs).
// Run it with `npm run lint`.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // Node files: the build config, the web tools and the tests
    files: ['vite.config.js', 'eslint.config.js', 'tools/**/*.js', '**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
