// React Native stopped shipping a bundled jest preset; from 0.87 it lives in
// @react-native/jest-preset. `preset: "react-native"` resolved to nothing, so
// all eight suites failed to *start* — the runner reported no failures because
// it never ran a single test.
const preset = require("@react-native/jest-preset");

module.exports = {
  ...preset,
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "json"],
  transform: {
    ...preset.transform,
    // `.mjs` included deliberately: lucide-react-native's `react-native` entry
    // point is an ESM bundle, so tests must transform the same build the app
    // ships rather than diverting to its CommonJS copy.
    "^.+\\.(ts|tsx|js|jsx|mjs)$": [
      "babel-jest",
      {
        presets: ["module:@react-native/babel-preset"],
        plugins: ["@babel/plugin-transform-export-namespace-from"],
      },
    ],
  },
  // Reanimated, Gesture Handler and Worklets ship untranspiled ESM.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-worklets|react-native-safe-area-context|react-native-screens|react-native-svg|lucide-react-native|yaml)/)",
  ],
  // Spread, not replaced: the preset maps `react-native` itself.
  moduleNameMapper: {
    ...preset.moduleNameMapper,
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
  setupFiles: [
    ...(preset.setupFiles ?? []),
    "<rootDir>/src/test/jestSetup.js",
    "<rootDir>/jest.setup.js",
  ],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts", "<rootDir>/src/**/__tests__/**/*.test.tsx"],
};
