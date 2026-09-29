CREATE TABLE `auth_limits` (
	`client` text PRIMARY KEY NOT NULL,
	`requests` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_limits_expiry` ON `auth_limits` (`expires`);