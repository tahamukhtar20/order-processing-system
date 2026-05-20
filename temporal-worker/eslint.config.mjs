import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['src/workflows/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="random"]',
          message: 'Math.random() is non-deterministic. Move randomness into an activity.',
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="now"]',
          message: 'Date.now() is non-deterministic. Pass timestamps as workflow arguments.',
        },
        {
          selector: 'NewExpression[callee.name="Date"]',
          message: 'new Date() is non-deterministic. Pass timestamps as workflow arguments.',
        },
      ],
    },
  },
);
