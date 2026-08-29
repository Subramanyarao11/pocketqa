module.exports = {
  preset: "react-native",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "babel-jest",
      {
        presets: ["module:@react-native/babel-preset"],
        plugins: ["@babel/plugin-transform-export-namespace-from"],
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|yaml)/)",
  ],
  moduleNameMapper: {
    "^@app/(.*)$": "<rootDir>/src/app/$1",
    "^@components$": "<rootDir>/src/components/index.ts",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@domain$": "<rootDir>/src/domain/index.ts",
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    "^@features/(.*)$": "<rootDir>/src/features/$1",
    "^@native$": "<rootDir>/src/native/index.ts",
    "^@native/(.*)$": "<rootDir>/src/native/$1",
    "^@navigation$": "<rootDir>/src/navigation/index.ts",
    "^@navigation/(.*)$": "<rootDir>/src/navigation/$1",
    "^@store$": "<rootDir>/src/store/index.ts",
    "^@store/(.*)$": "<rootDir>/src/store/$1",
    "^@theme$": "<rootDir>/src/theme/index.ts",
    "^@theme/(.*)$": "<rootDir>/src/theme/$1",
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts", "<rootDir>/src/**/__tests__/**/*.test.tsx"],
};
