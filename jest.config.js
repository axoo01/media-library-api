export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/tests/**/*.test.js'],
  // Only Prisma's generated TypeScript client is transformed; our own ESM .js runs untouched.
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'es6' } },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  globalSetup: '<rootDir>/src/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/src/tests/setup/globalTeardown.js',
  clearMocks: true,
};
