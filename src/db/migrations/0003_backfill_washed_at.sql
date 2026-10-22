-- Custom SQL migration file, put your code below! --
-- Pieces from before auto-laundry get a last wash, so their whole history
-- doesn't count against them: in the wash or at the cleaner since they went;
-- worn today, clean the day before; anything else, washed after its last wear.
UPDATE `items` SET `washed_at` = `status_changed_at`
  WHERE `washed_at` IS NULL AND `status` IN ('laundry', 'dry_cleaner') AND `status_changed_at` IS NOT NULL;
--> statement-breakpoint
UPDATE `items` SET `washed_at` = `last_worn_at` - 86400000
  WHERE `washed_at` IS NULL AND `status` = 'worn' AND `last_worn_at` IS NOT NULL;
--> statement-breakpoint
UPDATE `items` SET `washed_at` = `last_worn_at`
  WHERE `washed_at` IS NULL AND `last_worn_at` IS NOT NULL;
