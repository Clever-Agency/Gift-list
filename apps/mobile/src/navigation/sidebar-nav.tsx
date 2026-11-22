import {
  Avatar,
  focusRing,
  NavItem,
  Sidebar,
  Text,
  View,
  YStack,
} from "@gift-list/ui";
import { router, usePathname } from "expo-router";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { pressLink } from "@/navigation/link-press";
import { TAB_ITEMS, sectionOf } from "@/navigation/tab-items";

type SidebarUserCardProps = {
  name: string;
  nick: string;
  testID?: string;
};

const USER_CARD_FRAME = {
  flexDirection: "row",
  alignItems: "center",
  gap: "$3",
  minHeight: "$touch-target",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: "$md",
  backgroundColor: "transparent hover:$background",
  cursor: "pointer",
  textDecorationLine: "none",
  ...focusRing,
} as const;

/**
 * `DESIGN.md` → Навигация приложения: the user card at the bottom of the side
 * menu — the avatar, the full name and `@ник`. It is a link to «Профиль», where
 * the same actions (profile, settings, author, sign out) live as rows
 * (spec 6.2 → Open Question 4); the full popover menu is Story 6.3.
 *
 * The web half is a real `<a href>`; a plain left click goes through the router
 * (`pressLink`) so the SPA is not reloaded, while a modified click still opens
 * «Профиль» in a new tab. The phone navigates from the press. The name is not
 * clamped, so a long one wraps instead of losing its tail.
 */
function SidebarUserCard({ name, nick, testID }: SidebarUserCardProps) {
  function openProfile() {
    router.navigate("/profile");
  }

  const content = (
    <>
      <Avatar name={name} size="md" decorative />
      <YStack flex={1} minWidth={0}>
        <Text kind="body-strong">{name}</Text>
        <Text kind="body-sm" tone="muted">
          @{nick}
        </Text>
      </YStack>
    </>
  );

  if (Platform.OS === "web") {
    const link = {
      render: "a" as const,
      href: "/profile",
      onPress: pressLink("/profile"),
    };

    return (
      <View {...link} testID={testID} {...USER_CARD_FRAME}>
        {content}
      </View>
    );
  }

  return (
    <View role="link" onPress={openProfile} testID={testID} {...USER_CARD_FRAME}>
      {content}
    </View>
  );
}

SidebarUserCard.displayName = "SidebarUserCard";

export type SidebarNavProps = {
  /**
   * Incoming friend requests for the badge of «Друзья»; `null` and `0` draw no
   * badge. The count comes from `useInviteBadge()` in the tabs layout (wave D).
   */
  friendsCount?: number | null;
  testID?: string;
};

/**
 * `DESIGN.md` → Навигация приложения: the side menu of expanded screens. It
 * repeats the five sections of the bottom tabs with the full names («Мой
 * вишлист», «Мои брони»), marks the current root with `aria-current`, carries
 * the friend-request count on «Друзья» and ends with the user card leading to
 * «Профиль».
 *
 * The component only draws the menu: `AppShell` decides when it is visible (from
 * `expanded`, 1024 px), and the screen itself stays a `NavItem` from
 * `packages/ui`. The badge count is a prop so this file does not fetch anything;
 * the tabs layout passes it from the badge provider.
 */
export function SidebarNav({ friendsCount, testID }: SidebarNavProps) {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const auth = useAuth();

  const count =
    typeof friendsCount === "number" && friendsCount > 0 ? friendsCount : undefined;
  const friendsLabel = count === undefined ? undefined : t("friendsBadge", { count });

  const footer =
    auth.state.status === "ready" ? (
      <SidebarUserCard
        name={auth.state.user.name}
        nick={auth.state.user.nick}
        testID={testID ? `${testID}-user` : "sidebar-nav-user"}
      />
    ) : undefined;

  return (
    <Sidebar brand={getBrandName()} label={t("sections")} footer={footer} testID={testID}>
      {TAB_ITEMS.map(function renderSection(section) {
        // Nested screens (`/settings`, `/gifts/:id`) live above the tabs and show
        // no active item, as the side menu is hidden there anyway.
        const current = sectionOf(pathname)?.key === section.key;

        function openSection() {
          router.navigate(section.href);
        }

        return (
          <NavItem
            key={section.key}
            label={t(section.menuLabel)}
            secondary={section.key === "friends" ? friendsLabel : undefined}
            icon={<section.Icon />}
            badge={section.key === "friends" ? count : undefined}
            selected={current}
            variant="side"
            href={section.href}
            onPress={Platform.OS === "web" ? pressLink(section.href) : openSection}
            testID={testID ? `${testID}-${section.key}` : `sidebar-nav-${section.key}`}
          />
        );
      })}
    </Sidebar>
  );
}

SidebarNav.displayName = "SidebarNav";
