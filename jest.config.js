module.exports = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/packages/**/*.{js,ts}'],
  moduleNameMapper: {
    'fs-extra': '<rootDir>/node_modules/fs-extra',
  },
  coverageDirectory: '<rootDir>/coverage/',
  coveragePathIgnorePatterns: [
    '/.serverless_nextjs/',
    '/fixtures/',
    '/fixture/',
    '/dist/',
    '/tests/',
    '/__tests__/',
    '/serverless.js',
  ],
  watchPathIgnorePatterns: ['/fixture/', '/fixtures/'],
  testPathIgnorePatterns: [
    '/.next/',
    '/node_modules/',
    '/fixtures/',
    '/fixture/',
    '/examples/',
    'test-utils.ts',
    'aws-sdk.mock.ts',
  ],
};
