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
  collectCoverageFrom: ['src/**/*.js', '!src/tests/**'],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // The lab requires at least 80% for services and middleware; the build fails below it.
  coverageThreshold: {
    './src/services/': { statements: 80, branches: 80, functions: 80, lines: 80 },
    './src/middlewares/': { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
