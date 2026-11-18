import { createGiftListConfig, GiftListProvider, useThemeColor } from "@gift-list/ui";
import { Lora_600SemiBold } from "@expo-google-fonts/lora";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import { getLocales } from "expo-localization";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { IntlProvider } from "use-intl";
import { getMessages, negotiateLocale } from "@gift-list/contracts";
import { contactsAvailable } from "@/platform/contacts";
import { secureStoreAvailable } from "@/platform/secure-store";
import { AuthProvider } from "@/session/auth-context";

// The faces `useFonts` loads below carry the weight in their name, so the theme maps
// the weights onto them (one config per app: `createTamagui` registers itself).
const config = createGiftListConfig({
  body: "Manrope",
  heading: "Lora",
  bodyFaces: { 400: "Manrope", 500: "Manrope-500", 600: "Manrope-600" },
});

void contactsAvailable();
void secureStoreAvailable();

SplashScreen.preventAutoHideAsync().catch(function ignoreNoSplash() {
  // Web and fast refresh have no native splash to hold.
});

/**
 * The route stack: the page background under every screen comes from the active
 * Tamagui theme (`DESIGN.md` → v8), not from the light palette; outside a provider
 * the hook falls back to that palette for the first frame.
 */
function RootStack() {
  const background = useThemeColor("background");
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }} />;
}

RootStack.displayName = "RootStack";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Lora: Lora_600SemiBold,
    Manrope: Manrope_400Regular,
    "Manrope-500": Manrope_500Medium,
    "Manrope-600": Manrope_600SemiBold,
  });

  useEffect(function hideSplashWhenLoaded() {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(function ignoreHideError() {});
    }
  }, [loaded, error]);

  // This is the font/splash gate, not the session gate: on native the splash is kept
  // up by `preventAutoHideAsync` until `loaded || error`, so `null` is never a visible
  // blank page; on web the font fetch is short and a page cannot be themed before its
  // faces exist. Every guarded route handles the session itself with
  // `SessionLoadingScreen`.
  if (!loaded && !error) return null;

  const preferred = getLocales()
    .map((item) => item.languageTag)
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
  const locale = negotiateLocale(preferred);

  return (
    <GiftListProvider config={config}>
      <SafeAreaProvider>
        <IntlProvider locale={locale} messages={getMessages(locale)}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootStack />
          </AuthProvider>
        </IntlProvider>
      </SafeAreaProvider>
    </GiftListProvider>
  );
}

RootLayout.displayName = "RootLayout";
