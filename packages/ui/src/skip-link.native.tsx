import type { SkipLinkProps } from "./skip-link";

/**
 * The phone half of `SkipLink`: there is no keyboard order to skip, so the
 * component draws nothing. The prop is read only to keep the pair of the same
 * shape as `skip-link.tsx`.
 */
export function SkipLink(props: SkipLinkProps): null {
  void props;
  return null;
}

SkipLink.displayName = "SkipLink";
