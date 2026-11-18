import { View } from "@tamagui/core";
import { avatarInitials, AVATAR_DOT_EDGES, AVATAR_EDGES, AVATAR_STATUS_COLORS, type AvatarProps } from "./avatar.types";
import { Text } from "./text";

/**
 * The round avatar of v8 (`DESIGN.md` → Avatar): a photo or the initials on `muted`,
 * the sizes of the spacing tokens, and an optional status dot. It is the only round
 * form of the design system besides the switch and the slider thumb.
 *
 * Presentational: the name comes from the caller (it is the accessible name), the
 * status word comes translated (`statusLabel`) because colour alone never carries
 * meaning. Web half of the platform pair; the phone takes `avatar.native.tsx`.
 */
export function Avatar({
  name,
  photoUrl,
  size = "md",
  status,
  statusLabel,
  decorative = false,
  testID,
}: AvatarProps) {
  const edge = AVATAR_EDGES[size];
  const dot = AVATAR_DOT_EDGES[size];
  const accessibleName = statusLabel ? `${name}, ${statusLabel}` : name;

  return (
    <View
      testID={testID}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : accessibleName}
      aria-hidden={decorative ? true : undefined}
      width={edge}
      height={edge}
      flexShrink={0}
      borderRadius="$full"
      overflow="hidden"
      backgroundColor="$muted"
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Text
          kind={size === "sm" ? "caption" : "body-strong"}
          color="$muted-foreground"
          fontSize={size === "lg" ? "$heading" : undefined}
          lineHeight={size === "lg" ? "$heading" : undefined}
          aria-hidden
        >
          {avatarInitials(name)}
        </Text>
      )}
      {status ? (
        <View
          testID={testID ? `${testID}-status` : undefined}
          position="absolute"
          right={0}
          bottom={0}
          width={dot}
          height={dot}
          borderRadius="$full"
          borderWidth={2}
          borderColor="$background"
          backgroundColor={AVATAR_STATUS_COLORS[status]}
          aria-hidden
        />
      ) : null}
    </View>
  );
}

Avatar.displayName = "Avatar";
