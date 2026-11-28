import type { EditorialCollectionSummary } from "@gift-list/contracts";
import {
  Button,
  CollectionCard,
  Column,
  EmptyState,
  Heading,
  LoadingCards,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Text,
  YStack,
} from "@gift-list/ui";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { CardGridList } from "@/ui/card-grid-list";
import { SiteFooter } from "@/ui/site-footer";
import { useCardGrid } from "@/ui/use-card-grid";

/** The «Подборки» list: a skeleton, a retry view, the empty state or the cards. */
export type CollectionsState =
  | { status: "loading" }
  | { status: "ready"; collections: EditorialCollectionSummary[] }
  | { status: "error"; kind: "network" | "generic" };

export type CollectionsScreenProps = {
  state: CollectionsState;
  onRetry: () => void;
  onOpen: (id: string) => void;
};

/**
 * Story 10.1 (CLE-143, `EXPERIENCE.md` → «Подборки», `DESIGN.md` →
 * CollectionCard): the published collections as a card grid. The screen only
 * draws the state it is handed; the session, the request and the navigation
 * belong to the route, so a shared card cannot send two reads.
 *
 * The columns are the one app grid (`useCardGrid` + `CardGridList`): two up to
 * the `expanded` breakpoint and three from it. An empty answer is «Подборок пока
 * нет», a failed read is «Не получилось загрузить» + «Повторить», and the cold
 * load is the existing card skeleton.
 */
export function CollectionsScreen({ state, onRetry, onOpen }: CollectionsScreenProps) {
  const t = useTranslations("app.collections");
  const common = useTranslations("common");
  const brand = getBrandName();
  // W12.23: the browser measures the column the cards stand in, so a classic
  // scrollbar cannot push the right column past the gutter (`DESIGN.md` → Layout).
  const { cardWidth, attachContainer } = useCardGrid();

  let content: ReactNode;
  if (state.status === "loading") {
    content = (
      <LoadingCards
        testID="collections-loading"
        label={t("loading")}
        width={cardWidth}
        count={4}
      />
    );
  } else if (state.status === "error") {
    content = (
      <YStack
        width="100%"
        maxWidth="$max-form"
        alignSelf="center"
        paddingVertical="$4"
        gap="$grid-gap"
      >
        <Text tone="muted" textAlign="center" testID="collections-load-error">
          {state.kind === "network" ? t("loadError") : t("loadErrorGeneric")}
        </Text>
        <Button label={t("retry")} onPress={onRetry} testID="collections-retry" />
      </YStack>
    );
  } else if (state.collections.length === 0) {
    content = <EmptyState title={t("emptyTitle")} body={t("emptyText")} />;
  } else {
    content = (
      <CardGridList testID="collections-list">
        {state.collections.map(function renderCollection(collection) {
          const count = t("itemCount", { count: collection.itemCount });
          return (
            <YStack
              key={collection.id}
              role="listitem"
              width={cardWidth}
              alignItems="stretch"
            >
              <CollectionCard
                testID={`collection-${collection.id}`}
                title={collection.title}
                count={count}
                coverUrl={collection.coverImageUrl}
                width="100%"
                pressLabel={`${collection.title}, ${count}`}
                onPress={function openCollection() {
                  onOpen(collection.id);
                }}
              />
            </YStack>
          );
        })}
      </CardGridList>
    );
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: t("pageTitle", { brand }) }} />
        <PageScroll testID="collections-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{t("title")}</Heading>
              <YStack
                testID="collections-content"
                ref={attachContainer}
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
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

CollectionsScreen.displayName = "CollectionsScreen";
