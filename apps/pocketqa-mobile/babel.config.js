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
    'react-native-worklets/plugin',
  ],
};
