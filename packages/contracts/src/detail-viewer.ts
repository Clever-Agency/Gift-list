// The role a wish screen renders for: its own owner or a guest. The server
// already dropped anything the viewer must not see (`toOwnerGiftCard` /
// `toViewerGiftCard`), so the screen only picks the branch. The detail dialog of
// CLE-84 and its `toDetailFacts` gate are gone (CLE-129 / D-63): a wish opens as
// a page, and the page shows the card the server allowed.

/** Whose side of a wish the screen draws. */
export type DetailViewer = "owner" | "guest";
