ALTER TABLE `businessSettings` MODIFY COLUMN `businessName` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `businessSettings` MODIFY COLUMN `unitTownId` varchar(32) NOT NULL DEFAULT 'falkirk';--> statement-breakpoint
ALTER TABLE `businessSettings` MODIFY COLUMN `unitLabel` varchar(120) NOT NULL DEFAULT 'Main Storage Unit';--> statement-breakpoint
ALTER TABLE `businessSettings` MODIFY COLUMN `workdayStart` varchar(10) NOT NULL DEFAULT '08:30';--> statement-breakpoint
ALTER TABLE `helpers` MODIFY COLUMN `name` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` MODIFY COLUMN `customerName` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` MODIFY COLUMN `contactName` varchar(120) NOT NULL;