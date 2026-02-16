module.exports = {
  projects: [
    {
      displayName: 'main',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/main'],
      testMatch: ['<rootDir>/src/main/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^electron$': '<rootDir>/src/main/__tests__/helpers/__mocks__/electron.js',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)',
      ],
    },
    {
      displayName: 'renderer',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src/renderer'],
      testMatch: ['<rootDir>/src/renderer/__tests__/**/*.test.{ts,tsx}'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/renderer/main.tsx',
    '!src/main/main.ts',
  ],
};
