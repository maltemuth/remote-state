module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__test__'],
  testMatch: ['**/__test__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    // The e2e tests run the example server from source: it imports this library by
    // package name and uses ESM-style ".js" import specifiers
    '^@malte\\.muth/remote-state$': '<rootDir>/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
