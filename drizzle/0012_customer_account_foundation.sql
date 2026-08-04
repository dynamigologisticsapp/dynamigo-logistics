CREATE TABLE IF NOT EXISTS `businesses` (
  `id` varchar(64) NOT NULL,
  `name` varchar(120) NOT NULL,
  `contactName` varchar(120),
  `contactEmail` varchar(320),
  `contactPhone` varchar(30),
  `status` enum('pending','trial','active','suspended','closed') NOT NULL DEFAULT 'pending',
  `trialEndsAt` timestamp NULL,
  `activatedAt` timestamp NULL,
  `suspendedAt` timestamp NULL,
  `closedAt` timestamp NULL,
  `adminNotes` text,
  `stripeCustomerId` varchar(120),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
INSERT INTO `businesses` (`id`, `name`, `status`, `activatedAt`)
VALUES ('default-business', 'Dynamigo Logistics', 'active', CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE `name` = `name`;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `businessMemberships` (
  `id` varchar(64) NOT NULL,
  `businessId` varchar(64) NOT NULL DEFAULT 'default-business',
  `userId` int NOT NULL,
  `role` enum('owner','manager','driver','staff') NOT NULL DEFAULT 'owner',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `businessMemberships_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatus` enum('pending','active','suspended','closed') NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetRequired` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetTokenHash` varchar(128);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetExpiresAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `businessSettings` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
--> statement-breakpoint
ALTER TABLE `helpers` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
--> statement-breakpoint
ALTER TABLE `jobs` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
--> statement-breakpoint
ALTER TABLE `vans` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
--> statement-breakpoint
ALTER TABLE `vehicles` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
--> statement-breakpoint
ALTER TABLE `routeOrders` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
--> statement-breakpoint
ALTER TABLE `routeOrderHistory` ADD `businessId` varchar(64) NOT NULL DEFAULT 'default-business';
