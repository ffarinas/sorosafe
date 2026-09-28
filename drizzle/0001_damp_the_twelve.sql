ALTER TABLE `payments` ADD `kind` text DEFAULT 'payment' NOT NULL;--> statement-breakpoint
ALTER TABLE `vaults` ADD `network` text DEFAULT 'testnet' NOT NULL;