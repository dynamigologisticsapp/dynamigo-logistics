-- Create businesses table for multi-business support
CREATE TABLE IF NOT EXISTS `businesses` (
`id` varchar(36) NOT NULL,
`name` varchar(120) NOT NULL,
`email` varchar(120) NOT NULL UNIQUE,
`passwordHash` text NOT NULL,
`subscriptionTier` varchar(20) NOT NULL DEFAULT 'free',
`subscriptionStartDate` timestamp,
`subscriptionEndDate` timestamp,
`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;

-- Create vans table
CREATE TABLE IF NOT EXISTS `vans` (
`id` varchar(36) NOT NULL,
`businessId` varchar(36) NOT NULL,
`name` varchar(120) NOT NULL,
`driverName` varchar(120) NOT NULL,
`capacity` int NOT NULL DEFAULT 3,
`startingTownId` varchar(32) NOT NULL DEFAULT 'falkirk',
`isActive` boolean NOT NULL DEFAULT true,
`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `vans_id` PRIMARY KEY(`id`),
CONSTRAINT `vans_businessId_fk` FOREIGN KEY(`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create vanHelperAssignments table
CREATE TABLE IF NOT EXISTS `vanHelperAssignments` (
`id` varchar(36) NOT NULL,
`vanId` varchar(36) NOT NULL,
`helperId` varchar(36) NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT `vanHelperAssignments_id` PRIMARY KEY(`id`),
CONSTRAINT `vanHelperAssignments_vanId_fk` FOREIGN KEY(`vanId`) REFERENCES `vans`(`id`) ON DELETE CASCADE,
CONSTRAINT `vanHelperAssignments_helperId_fk` FOREIGN KEY(`helperId`) REFERENCES `helpers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Add businessId to existing tables
ALTER TABLE `businessSettings` ADD COLUMN `businessId` varchar(36) NOT NULL AFTER `id`;
ALTER TABLE `businessSettings` ADD CONSTRAINT `businessSettings_businessId_fk` FOREIGN KEY(`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE;
ALTER TABLE `businessSettings` DROP COLUMN `vanCapacity`;

ALTER TABLE `helpers` ADD COLUMN `businessId` varchar(36) NOT NULL AFTER `id`;
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_businessId_fk` FOREIGN KEY(`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE;

ALTER TABLE `jobs` ADD COLUMN `businessId` varchar(36) NOT NULL AFTER `id`;
ALTER TABLE `jobs` ADD COLUMN `vanId` varchar(36) AFTER `businessId`;
ALTER TABLE `jobs` ADD COLUMN `autoAssigned` boolean NOT NULL DEFAULT false AFTER `status`;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_businessId_fk` FOREIGN KEY(`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_vanId_fk` FOREIGN KEY(`vanId`) REFERENCES `vans`(`id`) ON DELETE SET NULL;
