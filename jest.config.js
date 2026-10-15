// The Counting engine is pure TypeScript, so tests run in plain Node:
// no device, no emulator, no React Native runtime.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
};
