import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";

// NOTE FOR UX: цель возврата после входа (Story 1.5). Список желаний — Story 3.3 и 2.1.

export default function WishlistReturnScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = paramValue(params.token) ?? "";
  const auth = useAuth();

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      router.replace({ pathname: "/login", params: { next: `/wishlist/${token}` } });
    }
  }, [auth.state.status, token]);

  if (auth.state.status !== "ready") return null;

  return (
    <>
      <Stack.Screen options={{ title: t("wishlist.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("wishlist.title")}>
        <Link href="/" style={navLinkStyle} accessibilityRole="link">
          {t("wishlist.toHome")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
