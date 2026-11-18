import { View } from "@tamagui/core";
import { Image } from "react-native";
import { avatarInitials, AVATAR_DOT_EDGES, AVATAR_EDGES, AVATAR_STATUS_COLORS, type AvatarProps } from "./avatar.types";
import { Text } from "./text";

/**
 * The phone half of `Avatar` (`DESIGN.md` → Avatar): the same circle, photo or
 * initials and status dot as `avatar.tsx`, drawn with React Native's `Image` because
 * the package ships no image library of its own.
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
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : accessibleName}
      accessible={!decorative}
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
        <Image
          source={{ uri: photoUrl }}
          accessibilityIgnoresInvertColors
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
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
