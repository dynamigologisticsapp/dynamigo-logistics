ALTER TABLE `jobs` MODIFY COLUMN `type` enum('pickup','delivery','both') NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `pickupCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `floor` varchar(50) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `duration` int DEFAULT 30 NOT NULL;