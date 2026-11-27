import type { VisiblePersonalDate } from "@gift-list/contracts";
import { Text, XStack, YStack } from "@gift-list/ui";
import { useLocale, useTranslations } from "use-intl";
import { personalDateText } from "@/profile/personal-date-text";

/**
 * Story 7.5 (AD-23): the dates a profile viewer may see, and only those — the
 * server already dropped every hidden date and closed year, so the block never
 * applies a rule of its own. An empty list draws nothing at all, so a stranger
 * cannot tell whether the owner has dates.
 */
export function ProfileDatesBlock({ dates }: { dates: readonly VisiblePersonalDate[] }) {
  const d = useTranslations("app.profile.dates");
  const locale = useLocale();

  if (dates.length === 0) return null;

  return (
    <YStack
      testID="profile-dates-block"
      width="100%"
      maxWidth="$max-content"
      gap="$2"
      padding="$3"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      backgroundColor="$surface"
    >
      <Text kind="label" tone="muted">
        {d("viewerTitle")}
      </Text>
      {dates.map(function renderDate(date) {
        return (
          <XStack
            key={date.id}
            testID={`profile-date-${date.id}`}
            gap="$2"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Text kind="body-strong">{date.title}</Text>
            <Text kind="caption" tone="muted">
              {personalDateText(date, locale)}
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}

ProfileDatesBlock.displayName = "ProfileDatesBlock";
