const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// Keep Expo on React 19.3.0 even when a hoisted package sits next to React 19.2.8.
config.resolver.disableHierarchicalLookup = true;

// CLE-64: keep function and class names in minified web exports so React DevTools
// shows component names (WishCard, ToastHost, …) instead of Anonymous.
function withKeptNames(options) {
  const kept = { keep_fnames: true, keep_classnames: true };

  // Keep `false` as is: it disables the pass, an object would enable it again.
  function keepIn(value) {
    if (value === false) {
      return false;
    }

    return value && typeof value === "object" ? { ...value, ...kept } : kept;
  }

  return {
    ...options,
    ...kept,
    mangle: keepIn(options?.mangle),
    compress: keepIn(options?.compress),
  };
}

config.transformer.minifierConfig = withKeptNames(
  config.transformer.minifierConfig,
);

module.exports = config;
