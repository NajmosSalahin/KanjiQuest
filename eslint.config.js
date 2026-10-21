import prettier from 'eslint-config-prettier';

/** Minimal flat config for Phase 0 (spec: husky + lint-staged runs ESLint + Prettier).
 *  React-specific lint plugins can be added later with owner approval. */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '.data/**',
      'server/uploads/**',
      'mockups.html',
      'package-lock.json',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Core ESLint can't see JSX usage (needs eslint-plugin-react — unapproved
    // until the owner opts in; see DECISIONS.md "ESLint scope").
    files: ['**/*.jsx'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  prettier,
];
