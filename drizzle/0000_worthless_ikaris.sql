CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`xdr` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`vault` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`vault`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_destination` ON `contacts` (`vault`,`address`,`memo`);--> statement-breakpoint
CREATE TABLE `members` (
	`vault` text NOT NULL,
	`address` text NOT NULL,
	PRIMARY KEY(`vault`, `address`),
	FOREIGN KEY (`vault`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`address`) REFERENCES `people`(`address`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `members_by_address` ON `members` (`address`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`vault` text NOT NULL,
	`contact` text NOT NULL,
	`recipient` text NOT NULL,
	`destination` text NOT NULL,
	`memo` text NOT NULL,
	`amount` text NOT NULL,
	`code` text NOT NULL,
	`issuer` text NOT NULL,
	`note` text NOT NULL,
	`proposer` text NOT NULL,
	`xdr` text NOT NULL,
	`hash` text NOT NULL,
	`expires` integer NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`vault`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_hash` ON `payments` (`hash`);--> statement-breakpoint
CREATE INDEX `payments_by_vault` ON `payments` (`vault`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_payment` ON `payments` (`vault`) WHERE "payments"."status" in ('pending','submitting');--> statement-breakpoint
CREATE TABLE `people` (
	`address` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`joined` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signatures` (
	`payment` text NOT NULL,
	`address` text NOT NULL,
	`signature` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`payment`, `address`),
	FOREIGN KEY (`payment`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`threshold` integer NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`address` text,
	`setup` text,
	`invite_hash` text,
	`created` integer NOT NULL
);
