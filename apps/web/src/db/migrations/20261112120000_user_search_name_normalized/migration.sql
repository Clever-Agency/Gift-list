-- Story 3.5 / AD-27: the searchable form of the display name.
--
-- `name` keeps the display case ("Алёна"); `nameNormalized` is what the search
-- compares ("алена"). The application writes both fields whenever it writes
-- `name`; this migration also backfills the users that already exist.
--
-- The backfill repeats `normalizeForSearch()` in SQL: NFC, lower case, `ё → е`
-- (`й` stays `й`). `translate` carries ASCII, Russian and the
-- Ukrainian/Belarusian letters, because a native cluster created with
-- `--locale=C` does not fold Cyrillic in `lower()`.
ALTER TABLE "User" ADD COLUMN "nameNormalized" TEXT;

UPDATE "User"
SET "nameNormalized" = replace(
    lower(
      translate(
        normalize("name", NFC),
        'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯІЇЄҐЎABCDEFGHIJKLMNOPQRSTUVWXYZ',
        'абвгдеёжзийклмнопрстуфхцчшщъыьэюяіїєґўabcdefghijklmnopqrstuvwxyz'
      )
    ),
    'ё',
    'е'
  );

ALTER TABLE "User" ALTER COLUMN "nameNormalized" SET NOT NULL;
