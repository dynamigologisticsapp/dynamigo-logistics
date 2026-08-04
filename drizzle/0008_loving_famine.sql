CREATE TABLE `routeOrders` (
	`id` varchar(64) NOT NULL,
	`dateKey` varchar(10) NOT NULL,
	`stopIds` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `routeOrders_id` PRIMARY KEY(`id`)
);
