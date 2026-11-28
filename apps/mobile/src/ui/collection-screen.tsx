import type { EditorialCollectionDetail, EditorialItem } from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  LoadingCards,
  PageContainer,
  PageScroll,
  Photo,
  SafeArea,
  Screen,
  Text,
  YStack,
} from "@gift-list/ui";
import { Stack } from "expo-router";
import { openURL } from "expo-linking";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { SiteFooter } from "@/ui/site-footer";

/** One published collection: the loaded card, the skeleton, a 404 or a failed read. */
export type CollectionState =
  | { status: "loading" }
  | { status: "ready"; collection: EditorialCollectionDetail }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

export type CollectionScreenProps = {
  state: CollectionState;
  /** The ideas already added during this visit: the button reads «Добавлено». */
  addedIds: ReadonlySet<string>;
  /** The ideas with a request in flight: the button is busy, the rest stay usable. */
  busyIds: ReadonlySet<string>;
  onRetry: () => void;
  onAdd: (item: EditorialItem) => void;
};

/**
 * Story 10.1 (CLE-143, `EXPERIENCE.md` → «Подборки»): one published collection
 * with its ideas. Each idea carries the link and the picture of the card and
 * «Добавить в мой вишлист»; after a successful add the button becomes
 * «Добавлено» and stays disabled during this visit (the state is not stored
 * between visits — an open decision of the plan).
 *
 * A draft, a future publication and an unknown id are the one `NOT_FOUND`, so
 * the screen shows the app's 404 page and cannot tell them apart (AD-12).
 * The request, the session and the toast belong to the route.
 */
export function CollectionScreen({
  state,
  addedIds,
  busyIds,
  onRetry,
  onAdd,
}: CollectionScreenProps) {
  const t = useTranslations("app.collections");
  const brand = getBrandName();

  if (state.status === "missing") return <NotFoundScreen />;

  const title = state.status === "ready" ? state.collection.title : t("title");

  let content: ReactNode;
  if (state.status === "loading") {
    content = <LoadingCards testID="collection-loading" label={t("detailLoading")} count={2} />;
  } else if (state.status === "error") {
    content = (
      <YStack
        width="100%"
        maxWidth="$max-form"
        alignSelf="center"
        paddingVertical="$4"
        gap="$grid-gap"
      >
        <Text tone="muted" textAlign="center" testID="collection-load-error">
          {state.kind === "network" ? t("loadError") : t("loadErrorGeneric")}
        </Text>
        <Button label={t("retry")} onPress={onRetry} testID="collection-retry" />
      </YStack>
    );
  } else {
    content = (
      <YStack gap="$2">
        <Heading level={1} kind="display-sm">
          {state.collection.title}
        </Heading>
        {state.collection.description ? (
          <Text tone="muted">{state.collection.description}</Text>
        ) : null}
        <YStack role="list" aria-label={t("ideasLabel")} gap="$section-gap" paddingTop="$2">
          {state.collection.items.map(function renderItem(item) {
            const added = addedIds.has(item.id);
            const busy = busyIds.has(item.id);
            const link = item.linkUrl;
            return (
              <YStack
                key={item.id}
                role="listitem"
                gap="$2"
                paddingBottom="$section-gap"
                borderBottomWidth={1}
                borderColor="$border"
                testID={`collection-item-${item.id}`}
              >
                {item.imageUrl ? (
                  <YStack
                    width="100%"
                    aspectRatio={16 / 9}
                    borderRadius="$lg"
                    overflow="hidden"
                    backgroundColor="$muted"
                  >
                    <Photo url={item.imageUrl} testID={`collection-item-photo-${item.id}`} />
                  </YStack>
                ) : null}
                <Heading level={2} kind="heading">
                  {item.title}
                </Heading>
                {item.description ? <Text>{item.description}</Text> : null}
                {link ? (
                  <Button
                    label={link}
                    href={link}
                    variant="ghost"
                    ariaLabel={`${t("link")}: ${link}`}
                    onPress={
                      Platform.OS === "web"
                        ? undefined
                        : function openIdeaLink() {
                            void openURL(link);
                          }
                    }
                  />
                ) : null}
                <Button
                  variant="secondary"
                  label={added ? t("added") : t("addToWishlist")}
                  disabled={added}
                  busy={busy}
                  onPress={function addIdea() {
                    onAdd(item);
                  }}
                  testID={`collection-add-${item.id}`}
                />
              </YStack>
            );
          })}
        </YStack>
      </YStack>
    );
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen
          options={{ title: state.status === "ready" ? title : t("pageTitle", { brand }) }}
        />
        <PageScroll testID="collection-page">
          <PageContainer>
            <Column
              size="content"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack flexGrow={1} paddingBottom="$section-gap" gap="$grid-gap">
                {content}
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

CollectionScreen.displayName = "CollectionScreen";
