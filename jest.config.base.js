// Shared by every package's jest.config.js: runs the TypeScript tests in
// `__test__` as native ESM, which requires NODE_OPTIONS=--experimental-vm-modules
export default {
  roots: ["<rootDir>/__test__"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    // Types are checked separately (npm run typecheck), so ts-jest only transpiles
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
