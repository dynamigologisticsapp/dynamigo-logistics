ALTER TABLE jobs MODIFY COLUMN sofaCount double NOT NULL;--> statement-breakpoint
ALTER TABLE jobs MODIFY COLUMN pickupCount double NOT NULL DEFAULT 0;
