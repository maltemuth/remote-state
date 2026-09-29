module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__test__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    // The package is ESM, but Jest runs the tests as CommonJS. Types are checked
    // separately (npm run typecheck), so ts-jest only transpiles.
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2024',
          module: 'commonjs',
          esModuleInterop: true,
          isolatedModules: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
