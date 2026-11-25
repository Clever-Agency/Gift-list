import { Pressable, Text, YStack } from "@gift-list/ui";
import { useTranslations } from "use-intl";
import { AuthorLink } from "@/ui/author-link";

export type ProfileMenuProps = {
  /**
   * «Мой профиль» opens `/u/{nick}`; the screen owns the navigation, so the menu
   * stays a plain list of rows (stories and tests hand in their own callbacks).
   */
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  /** The sign-out request is in flight: a second tap sends nothing. */
  signingOut?: boolean;
  testID?: string;
};

type ProfileRowProps = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
};

/**
 * One row of «Профиль»: the whole row is the target (44 px), the text is `button`
 * and the destructive «Выйти» is coral (`DESIGN.md` → Colors → Destructive).
 */
function ProfileRow({ label, onPress, destructive = false, disabled = false, testID }: ProfileRowProps) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      width="100%"
      minHeight="$row-height"
      justifyContent="center"
      paddingHorizontal="$3"
      paddingVertical={12}
      borderBottomWidth={1}
      borderColor="$border"
      backgroundColor="transparent hover:$background"
      cursor="pointer"
    >
      <Text kind="button" tone={destructive ? "destructive" : "primary"}>
        {label}
      </Text>
    </Pressable>
  );
}

ProfileRow.displayName = "ProfileRow";

/**
 * «Профиль» (Story 6.2, `DESIGN.md` → Навигация приложения): the sections of the
 * signed-in person in one place — «Мой профиль», «Настройки», «Написать автору»
 * and «Выйти». «Подборки» appear with Story 10.1 and are not listed yet; the full
 * user menu of the side bar is Story 6.3.
 *
 * The rows are the same actions the old temporary footer of «Мой вишлист» carried
 * (`EXPERIENCE.md` → Доступность: «Написать автору» у вошедшего — в «Профиле»).
 * The menu reads no data and sends nothing: the screen owns the session and the
 * routes.
 */
export function ProfileMenu({
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  signingOut = false,
  testID = "profile-menu",
}: ProfileMenuProps) {
  const nav = useTranslations("app.nav");
  const settings = useTranslations("app.settings");
  const wishlist = useTranslations("app.myWishlist");

  return (
    <YStack
      testID={testID}
      width="100%"
      maxWidth="$max-content"
      alignSelf="center"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      backgroundColor="$surface"
      overflow="hidden"
    >
      <ProfileRow
        label={nav("myProfile")}
        onPress={onOpenProfile}
        testID={`${testID}-my-profile`}
      />
      <ProfileRow
        label={settings("title")}
        onPress={onOpenSettings}
        testID={`${testID}-settings`}
      />
      {/* «Написать автору» stays the shared `AuthorLink` (AD-24): one address and
          one press behaviour across the footer and the profile. */}
      <YStack
        testID={`${testID}-author`}
        minHeight="$row-height"
        justifyContent="center"
        paddingHorizontal="$3"
        borderBottomWidth={1}
        borderColor="$border"
      >
        <AuthorLink />
      </YStack>
      <ProfileRow
        label={wishlist("logout")}
        onPress={onSignOut}
        destructive
        disabled={signingOut}
        testID={`${testID}-sign-out`}
      />
    </YStack>
  );
}

ProfileMenu.displayName = "ProfileMenu";
