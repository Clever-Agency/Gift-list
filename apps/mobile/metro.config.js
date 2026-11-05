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

// CLE-64: keeping function and class names in minified web exports lets React
// DevTools show component names (WishCard, ToastHost, …) instead of Anonymous.
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

/** Opt-in local debug flag: unset means the default minifier config, untouched. */
function keepFnamesEnabled() {
  const flag = process.env.KEEP_FNAMES;
  if (typeof flag !== "string") {
    return false;
  }

  const value = flag.trim().toLowerCase();
  return value === "1" || value === "true";
}

// CLE-64: KEEP_FNAMES=1 keeps all function and class names (libraries too) in the
// minified web export, which costs ~10% more JS. It is a local debugging aid and
// is never set on Vercel.
if (keepFnamesEnabled()) {
  config.transformer.minifierConfig = withKeptNames(
    config.transformer.minifierConfig,
  );
}

module.exports = config;
