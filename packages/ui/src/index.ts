// Public API of @gift-list/ui. Sources only, no build step (like @gift-list/contracts).
// Tamagui is imported by sub-path in this package, never from "tamagui" as a whole.

export {
  breakpoints,
  colors,
  colorsDark,
  highlights,
  rounded,
  shadows,
  spacing,
  typography,
  SCRIM_OPACITY,
  type ColorToken,
  type HighlightToken,
  type ShadowToken,
  type SpacingToken,
  type ThemeColors,
  type ThemeName,
  type TypographyRole,
} from "./tokens";
export { createGiftListConfig, type FontFamilies, type GiftListConfig } from "./config";
export { GiftListProvider, type GiftListProviderProps } from "./provider";

export { Column, PageContainer, Screen, View, XStack, YStack, ZStack } from "./layout";
export { SafeArea } from "./safe-area";
export type { SafeAreaProps } from "./safe-area.types";
export { PageScroll, type PageScrollProps } from "./page-scroll";
export { PageFooter, type PageFooterProps } from "./page-footer";
export { Badge, type BadgeProps } from "./badge";
export { NavItem, type NavItemProps, type NavItemVariant } from "./nav-item";
export { TabBar, type TabBarProps } from "./tab-bar";
export { Sidebar, type SidebarProps } from "./sidebar";
export { AppShell, type AppShellProps, useTabBarInset } from "./app-shell";
export { SkipLink, type SkipLinkProps } from "./skip-link";
export { Heading, LinkText, Text, type HeadingProps, type TextProps } from "./text";
export { ScrollView, type ScrollViewProps } from "./scroll";
export { focusRing } from "./focus-ring";
export { Pressable, type PressableProps } from "./pressable";
export { Switch, type SwitchProps } from "./switch";
export { Button, type ButtonProps, type ButtonVariant } from "./button";
export {
  IconButton,
  type IconButtonProps,
  type IconButtonShape,
  type IconButtonSize,
  type IconButtonVariant,
} from "./icon-button";
export {
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle,
  CircleAlert,
  Close,
  Eye,
  EyeOff,
  Heart,
  Info,
  Moon,
  Search,
  Star,
  User,
  Users,
} from "./icons";
export { Photo, type PhotoProps } from "./photo";
export { PhotoPlaceholder, type PhotoPlaceholderProps } from "./photo-placeholder";
export {
  PartnerStoreCard,
  type PartnerStoreCardProps,
} from "./partner-store-card";
export {
  PartnerStoreRail,
  type PartnerStoreRailProps,
} from "./partner-store-rail";
export { CollectionCard, type CollectionCardProps } from "./collection-card";
export { FriendsTwoPane, type FriendsTwoPaneProps } from "./friends-two-pane";
export { Avatar } from "./avatar";
export {
  avatarInitials,
  type AvatarProps,
  type AvatarSize,
  type AvatarStatus,
} from "./avatar.types";
export { InfoButton } from "./info-button";
export type { InfoButtonProps } from "./info-button.types";
export { DateField, type DateFieldProps } from "./date-field";
export {
  PasswordField,
  SearchField,
  TextField,
  type FieldInputRef,
  type PasswordFieldProps,
  type SearchFieldProps,
  type TextFieldInputProps,
  type TextFieldProps,
} from "./text-field";
export { Choice, ChoiceList, type ChoiceListProps, type ChoiceProps } from "./choice";
export {
  TagChip,
  TagChipList,
  type TagChipError,
  type TagChipListProps,
  type TagChipProps,
  type TagChipRef,
  type TagChipVariant,
} from "./tag-chip";
export { StatusPill, type StatusPillProps, type StatusPillStatus } from "./status-pill";
export { RelationshipChip, type RelationshipChipProps } from "./relationship-chip";
export {
  VisibilityChip,
  visibilityChipColors,
  useVisibilityChipColors,
  type VisibilityChipProps,
  type VisibilityTone,
} from "./visibility-chip";
export { WishCard, type WishCardProps } from "./wish-card";
export { Skeleton, WishCardSkeleton, type WishCardSkeletonProps } from "./skeleton";
export { LoadingCards, type LoadingCardsProps } from "./loading-cards";
export {
  PersonRow,
  PersonRowSkeleton,
  type PersonRowProps,
  type PersonRowSkeletonProps,
} from "./person-row";
export {
  OverflowMenu,
  type OverflowMenuItem,
  type OverflowMenuProps,
} from "./overflow-menu";
export { SegmentTabs, type SegmentTab, type SegmentTabsProps } from "./segment-tabs";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { Toast, type ToastProps, type ToastTone } from "./toast";
export { Dialog, type DialogProps } from "./dialog";
export { DetailDialog, type DetailDialogProps, type DetailFactView } from "./detail-dialog";
export { BottomSheet, type BottomSheetProps } from "./bottom-sheet";
export { useReduceMotion } from "./use-reduce";
export { useThemeColor } from "./theme-color";
export { focusField, focusInLayer, restoreFocus, type FocusTarget } from "./focus";
export { pressOnKeyDown } from "./press";
export { Bell } from "./icons";
export { NotificationRow, type NotificationRowProps } from "./notification-row";
