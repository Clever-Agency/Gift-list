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
import { SessionProvider } from "@/session/SessionProvider";
import { colors } from "@/theme/tokens";

void contactsAvailable();
void secureStoreAvailable();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Web and fast refresh have no native splash to hold.
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Lora: Lora_600SemiBold,
    Manrope: Manrope_400Regular,
    "Manrope-500": Manrope_500Medium,
    "Manrope-600": Manrope_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  const preferred = getLocales()
    .map((item) => item.languageTag)
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
  const locale = negotiateLocale(preferred);

  return (
    <SafeAreaProvider>
      <IntlProvider locale={locale} messages={getMessages(locale)}>
        <StatusBar style="dark" />
        <SessionProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </SessionProvider>
      </IntlProvider>
    </SafeAreaProvider>
  );
}
