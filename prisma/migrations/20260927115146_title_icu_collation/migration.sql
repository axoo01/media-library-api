-- Prisma has no collation attribute, so this is hand-written.
-- ICU root collation sorts titles alphabetically regardless of case ("apple" < "Beach" < "city")
-- and, unlike a nondeterministic collation, still supports LIKE/ILIKE for search.
ALTER TABLE "media" ALTER COLUMN "title" TYPE VARCHAR(255) COLLATE "und-x-icu";

-- Supports ORDER BY title (with the id tie-breaker) without a full sort.
CREATE INDEX "media_title_id_idx" ON "media"("title", "id");
