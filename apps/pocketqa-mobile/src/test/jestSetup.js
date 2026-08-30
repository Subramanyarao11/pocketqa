/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Screens render through TopBar, which reads useSafeAreaInsets(). Without a
// provider that hook throws, so every screen test failed before its first
// assertion. `.default` matters: the mock is an ESM module, so a bare require
// yields { __esModule: true, default: {...} } and every named import comes back
// undefined — which surfaces as "useSafeAreaInsets is not a function".
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
