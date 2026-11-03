// Closed sets of the gift domain. They live in their own module so `gift.ts`
// and `index.ts` can both import them: a direct `gift.ts` → `index.ts` import
// would be a cycle (index re-exports gift), and the constants are not defined
// yet when gift.ts is evaluated first.
export const CURRENCIES = ["USD", "EUR", "CNY", "BYN", "RUB"] as const;
export const VISIBILITIES = ["PUBLIC", "FRIENDS", "SECRET"] as const;
export const QUANTITIES = ["SINGLE", "UNLIMITED"] as const;
export const GIFT_STATUSES = ["OPEN", "RESERVED", "CLOSED"] as const;
export const RESERVATION_LABELS = ["BOUGHT", "GIVEN"] as const;
export const OWNER_ACTIONS = ["CONFIRM_GIVEN", "EXPIRED_NO_REPLY"] as const;
