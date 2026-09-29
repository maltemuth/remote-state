// Runs the tests as native ESM; requires NODE_OPTIONS=--experimental-vm-modules
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/__test__"],
  testMatch: ["**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    // Types are checked separately (npm run typecheck), so ts-jest only transpiles
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
