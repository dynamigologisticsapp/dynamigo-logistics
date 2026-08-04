CREATE TABLE `businessSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`unitTownId` varchar(32) NOT NULL,
	`unitLabel` varchar(255) NOT NULL,
	`vanCapacity` int NOT NULL DEFAULT 3,
	`optimizeFor` enum('time') NOT NULL DEFAULT 'time',
	`workdayStart` varchar(5) NOT NULL DEFAULT '08:30',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `helpers` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`townId` varchar(32) NOT NULL,
	`weekdayAvailable` int NOT NULL DEFAULT 1,
	`weekendAvailable` int NOT NULL DEFAULT 0,
	`notes` text,
	CONSTRAINT `helpers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(64) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactPhone` varchar(20) NOT NULL,
	`addressLine` text NOT NULL,
	`townId` varchar(32) NOT NULL,
	`type` enum('pickup','delivery') NOT NULL,
	`sofaCount` int NOT NULL,
	`scheduledDay` varchar(10) NOT NULL,
	`timeWindow` varchar(50) NOT NULL,
	`notes` text,
	`status` enum('scheduled','cancelled','completed') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
