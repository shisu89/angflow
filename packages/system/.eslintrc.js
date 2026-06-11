module.exports = {
  root: true,
  extends: ['@angflow/eslint-config'],
  // Spec files are excluded from tsconfig.json so the project service cannot
  // parse them with typed rules. Ignore them rather than fight the tsconfig.
  ignorePatterns: ['**/*.spec.ts'],
};
