-- [manual] Triggers, functions, a procedure and a view for core business rules.
-- Prisma schema language cannot describe these objects, so they are written by hand.
-- Times are UTC: the columns are TIMESTAMP(3) without a time zone and Prisma stores UTC there.

-- ============================================================================
-- [manual] T1. DM-09: publishedAt is set on publish and cleared on unpublish
-- ============================================================================
CREATE OR REPLACE FUNCTION card_set_published_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.published THEN
    -- An explicit date (seed, import) is kept; otherwise the moment of publication.
    IF NEW."publishedAt" IS NULL THEN
      NEW."publishedAt" := now() AT TIME ZONE 'UTC';
    END IF;
  ELSE
    NEW."publishedAt" := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER card_published_at_trg
BEFORE INSERT OR UPDATE OF published, "publishedAt" ON "Card"
FOR EACH ROW EXECUTE FUNCTION card_set_published_at();

-- ============================================================================
-- [manual] T2. DM-07: a note on a card always carries the card's culture
-- ============================================================================
CREATE OR REPLACE FUNCTION note_sync_culture() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."cardId" IS NOT NULL THEN
    SELECT c."cultureId" INTO NEW."cultureId" FROM "Card" c WHERE c.id = NEW."cardId";
  END IF;
  RETURN NEW;
END $$;

-- Deleting a card sets Note.cardId to NULL (FK ON DELETE SET NULL); the trigger then keeps
-- the culture already stored in the note, so the note stays attached to the culture.
CREATE TRIGGER note_sync_culture_trg
BEFORE INSERT OR UPDATE OF "cardId" ON "Note"
FOR EACH ROW EXECUTE FUNCTION note_sync_culture();

-- ============================================================================
-- [manual] F1. BR-04 / DM-03: time slice of the map
-- ============================================================================
-- Regions occupied in p_year by a culture that has at least one published card, each with
-- the list of those cultures.
-- - `active` keeps one row per (region, culture): a culture may have several overlapping
--   CultureRegion periods in one region. The year filter can use the
--   ("startYear", "endYear") index; the approximate-dating flag is OR-ed across periods.
-- - EXISTS stops at the first published card instead of counting all of them.
-- - json_agg builds the nested `cultures` array in the database, so one query
--   returns the whole slice (no extra query per region).
CREATE OR REPLACE FUNCTION active_regions_at(p_year integer)
RETURNS TABLE (id text, slug text, name text, geojson jsonb,
               "centerLat" double precision, "centerLng" double precision, cultures json)
LANGUAGE sql STABLE AS $$
  WITH active AS (
    SELECT cr."regionId",
           cr."cultureId",
           bool_or(cr."dateApproximate") AS "dateApproximate"
    FROM "CultureRegion" cr
    WHERE cr."startYear" <= p_year
      AND cr."endYear" >= p_year
      AND EXISTS (
        SELECT 1 FROM "Card" card
        WHERE card."cultureId" = cr."cultureId" AND card.published
      )
    GROUP BY cr."regionId", cr."cultureId"
  )
  SELECT r.id,
         r.slug,
         r.name,
         r.geojson,
         r."centerLat",
         r."centerLng",
         json_agg(
           json_build_object(
             'id', c.id,
             'slug', c.slug,
             'name', c.name,
             'color', c.color,
             'dateApproximate', a."dateApproximate"
           ) ORDER BY c.name
         ) AS cultures
  FROM active a
  JOIN "Region" r ON r.id = a."regionId"
  JOIN "Culture" c ON c.id = a."cultureId"
  GROUP BY r.id
  ORDER BY r.name
$$;

-- ============================================================================
-- [manual] F2. BR-15: nearest day with dated events
-- ============================================================================
-- The first day, starting from (p_month, p_day) and wrapping around the end of the year, on
-- which an EXACT holiday or a visible dated card falls. Days are compared as month * 100 + day:
-- days before the start sort after the rest of the year (false < true).
-- Drafts count only when p_include_drafts is true (admins).
CREATE OR REPLACE FUNCTION next_dated_day(p_month integer, p_day integer, p_include_drafts boolean)
RETURNS TABLE (month integer, day integer)
LANGUAGE sql STABLE AS $$
  SELECT dated.month, dated.day
  FROM (
    SELECT h.month, h.day FROM "Holiday" h
    WHERE h."dateType" = 'EXACT'
    UNION
    SELECT c.month, c.day FROM "Card" c
    WHERE c.month IS NOT NULL AND c.day IS NOT NULL AND (p_include_drafts OR c.published)
  ) AS dated
  ORDER BY (dated.month * 100 + dated.day < p_month * 100 + p_day), dated.month, dated.day
  LIMIT 1
$$;

-- ============================================================================
-- [manual] P1. BR-03: revoke every active session of a user
-- ============================================================================
-- Used on refresh token reuse detection and on password change.
CREATE OR REPLACE PROCEDURE revoke_user_sessions(p_user_id text)
LANGUAGE sql AS $$
  UPDATE "RefreshToken"
  SET "revokedAt" = now() AT TIME ZONE 'UTC'
  WHERE "userId" = p_user_id AND "revokedAt" IS NULL;
$$;

-- ============================================================================
-- [manual] V1. BR-12: best finished attempt and attempt count per user and quiz
-- ============================================================================
-- DISTINCT ON keeps the first row of each (user, quiz) in ORDER BY order: the highest score,
-- the earliest of equal scores. The window COUNT runs before DISTINCT ON, so it counts
-- every finished attempt of the pair. Unfinished attempts are not results yet.
CREATE OR REPLACE VIEW quiz_best_result AS
SELECT DISTINCT ON (a."userId", a."quizId")
       a."userId",
       a."quizId",
       a.score                    AS "bestScore",
       a.total,
       COALESCE(a.passed, false)  AS passed,
       (COUNT(*) OVER (PARTITION BY a."userId", a."quizId"))::int AS attempts
FROM "QuizAttempt" a
WHERE a."finishedAt" IS NOT NULL
ORDER BY a."userId", a."quizId", a.score DESC, a."finishedAt" ASC;
