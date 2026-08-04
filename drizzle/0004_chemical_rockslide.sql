CREATE TABLE `vans` (
	`id` varchar(64) NOT NULL,
	`driverName` varchar(120) NOT NULL,
	`vehicleId` varchar(64) NOT NULL,
	`startingTownId` varchar(32) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`capacity` int NOT NULL DEFAULT 3,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `businessSettings` MODIFY COLUMN `unitAddress` text NOT NULL;