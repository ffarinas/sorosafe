CREATE TABLE `sponsorships` (
	`address` text NOT NULL,
	`day` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`address`, `day`)
);
