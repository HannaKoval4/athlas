import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/prisma'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // The generated Prisma client imports siblings as "./x.js" (nodenext); resolve them to .ts.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'prisma/seed/**/*.ts',
    '!src/main.ts',
    '!src/generated/**',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
