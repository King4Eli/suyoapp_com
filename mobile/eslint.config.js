/**
 * Flat config (ESLint 8.57+ / 9). `@react-native/eslint-config` is still
 * eslintrc-style, so it's bridged in with FlatCompat.
 */
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'Pods/**',
      'android/**',
      'ios/**',
      'vendor/**',
      'coverage/**',
      'build/**',
      'types/**', // local .d.ts stubs for untyped deps
      '*.config.js',
      'metro.config.js',
      'babel.config.js',
      'jest.config.js',
    ],
  },

  ...compat.extends('@react-native'),

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Stylistic-only / high-volume rules we don't enforce in this codebase.
      'react-native/no-inline-styles': 'off',

      // Code-quality rules we do care about.

      'react/no-unstable-nested-components': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },

  {
    // `@typescript-eslint` is only registered for TS files (via the RN config).
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
