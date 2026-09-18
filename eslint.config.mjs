import oclif from 'eslint-config-oclif'

export default [
  {
    ignores: ['dist/**'],
  },
  ...oclif,
  {
    // Loaded through mocha's `require` option, so it has to stay CommonJS.
    files: ['test/helpers/init.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'unicorn/prefer-module': 'off',
    },
  },
]
