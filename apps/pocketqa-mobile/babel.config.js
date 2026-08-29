module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@app': './src/app',
          '@components': './src/components',
          '@domain': './src/domain',
          '@features': './src/features',
          '@native': './src/native',
          '@navigation': './src/navigation',
          '@services': './src/services',
          '@store': './src/store',
          '@theme': './src/theme',
          '@utils': './src/utils',
        },
      },
    ],
    // Must stay last. Reanimated 4 moved worklets into its own package, so this
    // is the correct plugin for the installed 4.6.0 — not the Reanimated 3
    // 'react-native-reanimated/plugin'.
    // src/domain/index.ts uses `export * as ns from`, which needs this. It was
    // already listed in jest.config.js's babel options but never in the app's
    // own babel config, so the bundle failed while the tests would have passed.
    '@babel/plugin-transform-export-namespace-from',
    // Must stay last.
    'react-native-worklets/plugin',
  ],
};
