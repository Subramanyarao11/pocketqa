module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["./src"],
        alias: {
          "@app": "./src/app",
          "@components": "./src/components",
          "@domain": "./src/domain",
          "@features": "./src/features",
          "@native": "./src/native",
          "@navigation": "./src/navigation",
          "@services": "./src/services",
          "@store": "./src/store",
          "@theme": "./src/theme",
          "@utils": "./src/utils",
        },
      },
    ],
    "react-native-reanimated/plugin",
  ],
};
