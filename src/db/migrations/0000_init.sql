CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`wardrobe_id` text NOT NULL,
	`zone_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`colors` text NOT NULL,
	`pattern` text,
	`material` text,
	`brand` text,
	`size` text,
	`seasons` text NOT NULL,
	`occasions` text NOT NULL,
	`tags` text NOT NULL,
	`price` real,
	`currency` text,
	`purchase_date` integer,
	`store` text,
	`care_notes` text,
	`original_uri` text,
	`cutout_uri` text,
	`thumb_uri` text,
	`status` text DEFAULT 'in_wardrobe' NOT NULL,
	`lent_to` text,
	`lent_at` integer,
	`archived_reason` text,
	`archived_note` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`wear_count` integer DEFAULT 0 NOT NULL,
	`last_worn_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`wardrobe_id`) REFERENCES `wardrobes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `items_wardrobe_idx` ON `items` (`wardrobe_id`);--> statement-breakpoint
CREATE INDEX `items_zone_idx` ON `items` (`zone_id`);--> statement-breakpoint
CREATE INDEX `items_status_idx` ON `items` (`status`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category`);--> statement-breakpoint
CREATE TABLE `outfit_items` (
	`id` text PRIMARY KEY NOT NULL,
	`outfit_id` text NOT NULL,
	`item_id` text NOT NULL,
	`x` real DEFAULT 0.5 NOT NULL,
	`y` real DEFAULT 0.5 NOT NULL,
	`scale` real DEFAULT 1 NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`z_index` integer DEFAULT 0 NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`outfit_id`) REFERENCES `outfits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outfit_items_unique` ON `outfit_items` (`outfit_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `outfit_items_item_idx` ON `outfit_items` (`item_id`);--> statement-breakpoint
CREATE TABLE `outfits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`occasion` text,
	`seasons` text NOT NULL,
	`snapshot_uri` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `planned_outfits` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`outfit_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`outfit_id`) REFERENCES `outfits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `planned_outfits_date_idx` ON `planned_outfits` (`date`);--> statement-breakpoint
CREATE TABLE `trip_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`item_id` text,
	`outfit_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`packed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`outfit_id`) REFERENCES `outfits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trip_items_trip_idx` ON `trip_items` (`trip_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`destination` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `wardrobes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'home' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `wear_log_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wear_log_id` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`wear_log_id`) REFERENCES `wear_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wear_log_items_unique` ON `wear_log_items` (`wear_log_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `wear_log_items_item_idx` ON `wear_log_items` (`item_id`);--> statement-breakpoint
CREATE TABLE `wear_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`outfit_id` text,
	`photo_uri` text,
	`weather` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`outfit_id`) REFERENCES `outfits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wear_logs_date_idx` ON `wear_logs` (`date`);--> statement-breakpoint
CREATE TABLE `wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image_uri` text,
	`url` text,
	`price` real,
	`currency` text,
	`category` text,
	`colors` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `zones` (
	`id` text PRIMARY KEY NOT NULL,
	`wardrobe_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`wardrobe_id`) REFERENCES `wardrobes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `zones_wardrobe_idx` ON `zones` (`wardrobe_id`);