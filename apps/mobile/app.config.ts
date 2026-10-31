import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Gift List",
  slug: "gift-list",
  scheme: "giftlist",
  version: "0.1.0",
  orientation: "default",
  userInterfaceStyle: "light",
  web: {
    output: "single",
    bundler: "metro",
    lang: "ru",
  },
  plugins: ["expo-router"],
  ios: {
    bundleIdentifier: "app.giftlist.mobile",
  },
  android: {
    package: "app.giftlist.mobile",
  },
};

export default config;
