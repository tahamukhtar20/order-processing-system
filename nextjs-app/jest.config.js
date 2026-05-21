const path = require('path');
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  passWithNoTests: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@worker-types$': path.resolve(__dirname, '../temporal-worker/src/shared/types'),
    '^@worker-types/(.*)$': path.resolve(__dirname, '../temporal-worker/src/shared/types/$1'),
  },
};

module.exports = createJestConfig(config);
