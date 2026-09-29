module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__test__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    // The package is ESM, but Jest runs the tests as CommonJS
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }],
  },
  moduleNameMapper: {
    '^@malte\\.muth/remote-state$': '<rootDir>/../remote-state/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
