import {
  Button,
  Column,
  Heading,
  PageContainer,
  PageScroll,
  Pressable,
  SafeArea,
  Screen,
  SearchField,
  Text,
  YStack,
} from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { prepareUserSearchQuery } from "@/search/search-query";
import { InstallHint, useInstallHint } from "@/ui/install-hint";
import { useInstallHintPlacement } from "@/ui/install-hint-placement";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";

/**
 * «Найти знакомых» in a browser (Story 6.5, UX-DR11): the phone syncs the address
 * book (Story 8.1), the browser does not. The screen says so and offers the same
 * search by nick and name that `/search` already runs, plus the install hint at
 * the top while it is open. The route is linked only from the browser build; the
 * phone keeps its current shortcut to `/search`.
 */
export default function FindContactsScreen() {
  const auth = useAuth();

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
        router.replace({
          pathname: "/login",
          params: { next: "/friends/contacts" },
        });
      }
    },
    [auth.state.status],
  );

  if (auth.state.status === "error") {
    return <SessionErrorScreen size="form" onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen size="form" />;

  return <FindContactsContent />;
}

FindContactsScreen.displayName = "FindContactsScreen";

function FindContactsContent() {
  const t = useTranslations("app.findContacts");
  const search = useTranslations("app.search");
  const common = useTranslations("common");
  const friends = useTranslations("app.friends");
  const brand = getBrandName();
  const hint = useInstallHint();
  const placement = useInstallHintPlacement();
  const [query, setQuery] = useState("");

  function goBack() {
    // A direct link has no history behind it: the friends tab is the way back.
    if (router.canGoBack()) router.back();
    else router.replace("/friends");
  }

  function openSearch() {
    const prepared = prepareUserSearchQuery(query);
    if (prepared === "") {
      router.push("/search");
      return;
    }
    router.push({ pathname: "/search", params: { q: prepared } });
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: t("pageTitle", { brand }) }} />
        <PageScroll testID="find-contacts-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Pressable
                role="button"
                aria-label={friends("back")}
                onPress={goBack}
                alignSelf="flex-start"
                justifyContent="center"
                minHeight="$touch-target"
                minWidth="$touch-target"
              >
                <Text kind="button" tone="primary">
                  {friends("back")}
                </Text>
              </Pressable>
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{t("title")}</Heading>
              {placement === "card" && hint.visible ? (
                <InstallHint onClose={hint.dismiss} testID="install-hint" />
              ) : null}
              <YStack flexGrow={1} paddingTop="$2" paddingBottom="$section-gap" gap="$grid-gap">
                <Text tone="muted">{t("explain")}</Text>
                <SearchField
                  label={t("searchLabel")}
                  placeholder={t("searchLabel")}
                  value={query}
                  onChangeText={setQuery}
                  clearLabel={search("clear")}
                  testID="find-contacts-search"
                  input={{
                    autoCapitalize: "none",
                    autoCorrect: false,
                    returnKeyType: "search",
                    onSubmitEditing: openSearch,
                  }}
                />
                <Button label={t("searchAction")} onPress={openSearch} />
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

FindContactsContent.displayName = "FindContactsContent";
