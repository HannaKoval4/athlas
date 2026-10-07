-- [manual] Fix: CHECK constraints let incomplete dates through.
-- In SQL, `NULL BETWEEN 1 AND 31` is NULL, and a CHECK that evaluates to NULL passes.
-- So month = 5 with day = NULL satisfied the old card_date_chk / holiday_exact_chk.
-- Found by e2e tests (constraints.e2e-spec.ts); explicit IS NOT NULL closes the gap.

ALTER TABLE "Card" DROP CONSTRAINT card_date_chk;
ALTER TABLE "Card" ADD CONSTRAINT card_date_chk
    CHECK (("month" IS NULL AND "day" IS NULL)
        OR ("month" IS NOT NULL AND "day" IS NOT NULL
            AND "month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31));

ALTER TABLE "Holiday" DROP CONSTRAINT holiday_exact_chk;
ALTER TABLE "Holiday" ADD CONSTRAINT holiday_exact_chk
    CHECK ("dateType" <> 'EXACT'
        OR ("month" IS NOT NULL AND "day" IS NOT NULL
            AND "month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31));
