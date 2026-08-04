CREATE TABLE `routeOrderHistory` (
	`id` varchar(64) NOT NULL,
	`dateKey` varchar(10) NOT NULL,
	`stopIds` text NOT NULL,
	`changeType` enum('reorder','reset') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `routeOrderHistory_id` PRIMARY KEY(`id`)
);
