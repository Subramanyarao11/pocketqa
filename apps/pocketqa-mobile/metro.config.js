const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

// This app lives in an npm workspace, so npm hoists most dependencies to the
// repo root. Metro only watches its own project directory by default, so a
// hoisted package — @babel/runtime, for one — is invisible to it and the bundle
// fails with "Unable to resolve module". Watching the workspace root and adding
// its node_modules to the resolver is the standard monorepo setup, and it makes
// bundling work regardless of where npm decides to hoist.
const workspaceRoot = path.resolve(__dirname, "../..");

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    // react-native 0.87 ships internal packages (@react-native/asset-utils,
    // for one) that declare only `exports`, with no `main`. The installed
    // metro-config still defaults this off, so Metro falls back to `main`,
    // resolves `index`, finds nothing, and the whole bundle fails.
    unstable_enablePackageExports: true,
    nodeModulesPaths: [
      path.resolve(__dirname, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
