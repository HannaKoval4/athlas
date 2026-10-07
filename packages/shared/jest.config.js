import { createDefaultEsmPreset } from 'ts-jest';

// The package is native ESM ("type": "module"), so ts-jest runs in ESM mode.
/** @type {import('jest').Config} */
const config = {
  ...createDefaultEsmPreset(),
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  // Sources import siblings with ".js" extensions (nodenext); map them back to .ts files.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/index.ts'],
  coverageDirectory: './coverage',
};

export default config;
