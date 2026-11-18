-- CLE-100 / Story 4.7: users who existed before InviteLink need a row before
-- `GET /api/v1/me/invite-link` can read it. New accounts get a CUID2 token in
-- `registerUser`; this migration only inserts missing rows and never rewrites a
-- token that registration or a prior run already stored.
--
-- Idempotent: `ON CONFLICT ("userId") DO NOTHING` keeps an existing link and
-- makes a repeated deploy a no-op.

INSERT INTO "InviteLink" ("userId", "token", "createdAt")
SELECT u."id", replace(gen_random_uuid()::text, '-', ''), NOW()
FROM "User" u
LEFT JOIN "InviteLink" il ON il."userId" = u."id"
WHERE il."userId" IS NULL
ON CONFLICT ("userId") DO NOTHING;
