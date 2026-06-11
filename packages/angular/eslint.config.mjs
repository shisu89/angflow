// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // Baseline-friendly: the port has intentional `any` at framework boundaries.
      '@typescript-eslint/no-explicit-any': 'off',
      // Many imports are used only as Angular @Input/@Output type annotations or
      // as public re-exports; the rule cannot see template usage. Turned off to
      // unblock the baseline — clean-up tracked separately.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
