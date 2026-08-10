-- Auto-generated schema snapshot for dev self-initialization.
-- Regenerate after schema changes: npm run db:bootstrap
-- Applied by db/index.ts ONLY when the users table is missing.
CREATE TABLE IF NOT EXISTS `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`applicant_id` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`role_id` text,
	`interview` text DEFAULT '{}' NOT NULL,
	`offer` text DEFAULT '{}' NOT NULL,
	`availability` text DEFAULT 'yes' NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`applicant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `bids` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`bidder_id` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `campus_listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bidder_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`via_label` text DEFAULT '' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text,
	`client_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_min` integer DEFAULT 60 NOT NULL,
	`price` integer NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`travel_fee` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` text DEFAULT '' NOT NULL,
	`proposed_starts_at` integer,
	`conversation_id` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `bookmarks` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `campus_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`campus_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`type` text DEFAULT 'fixed' NOT NULL,
	`price` integer,
	`condition` text DEFAULT '' NOT NULL,
	`media` text DEFAULT '[]' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`claimed` integer DEFAULT 0 NOT NULL,
	`fulfillment` text DEFAULT '["pickup"]' NOT NULL,
	`meet_spot` text DEFAULT '' NOT NULL,
	`first_come` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`claimed_by_id` text,
	`auction_ends_at` integer,
	`reserve_price` integer,
	`bid_increment` integer DEFAULT 1 NOT NULL,
	`max_borrow_days` integer,
	`allow_extensions` integer DEFAULT true NOT NULL,
	`deposit` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `campus_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`campus_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`affiliation` text DEFAULT 'current_student' NOT NULL,
	`evidence_ref` text,
	`program` text DEFAULT '' NOT NULL,
	`grad_year` text DEFAULT '' NOT NULL,
	`show_school` integer DEFAULT true NOT NULL,
	`show_grad_year` integer DEFAULT true NOT NULL,
	`show_program` integer DEFAULT false NOT NULL,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `campuses` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`access` text DEFAULT 'public' NOT NULL,
	`mode` text DEFAULT 'discussion' NOT NULL,
	`kind` text DEFAULT 'standard' NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`avatar_url` text,
	`cover_url` text,
	`rules` text DEFAULT '[]' NOT NULL,
	`join_approval` integer DEFAULT false NOT NULL,
	`who_can_post` text DEFAULT 'members' NOT NULL,
	`who_can_invite` text DEFAULT 'mods' NOT NULL,
	`identity_modes` text DEFAULT '["real"]' NOT NULL,
	`capacity` integer,
	`price` integer DEFAULT 0 NOT NULL,
	`billing_period` text DEFAULT 'monthly' NOT NULL,
	`custom_period_days` integer,
	`grace_days` integer DEFAULT 3 NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`campus_id` text,
	`audience` text DEFAULT 'everyone' NOT NULL,
	`created_by_id` text NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `community_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`identity` text DEFAULT 'real' NOT NULL,
	`body` text NOT NULL,
	`removed_at` integer,
	`removed_by_id` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `community_members` (
	`community_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`member_until` integer,
	`expiry_notified` integer DEFAULT false NOT NULL,
	`grace_notified` integer DEFAULT false NOT NULL,
	`alias` text,
	`anon_code` text,
	`last_identity` text DEFAULT 'real' NOT NULL,
	`muted_until` integer,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`community_id`, `user_id`),
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `community_mod_log` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text DEFAULT '' NOT NULL,
	`target_id` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`author_id` text NOT NULL,
	`identity` text DEFAULT 'real' NOT NULL,
	`body` text NOT NULL,
	`media` text DEFAULT '[]' NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`removed_at` integer,
	`removed_by_id` text,
	`removed_reason` text DEFAULT '' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `community_reactions` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `conversation_members` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` integer,
	PRIMARY KEY(`conversation_id`, `user_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE TABLE IF NOT EXISTS `disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`opened_by_id` text NOT NULL,
	`kind` text DEFAULT 'problem' NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`return_tracking` text DEFAULT '' NOT NULL,
	`resolution_note` text DEFAULT '' NOT NULL,
	`resolved_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opened_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `event_rsvps` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`host_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`campus_id` text,
	`public_visibility` integer DEFAULT false NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`starts_at` integer NOT NULL,
	`time_label` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`lat` real,
	`lng` real,
	`price` integer,
	`capacity` integer,
	`attending` integer DEFAULT 0 NOT NULL,
	`image_url` text,
	`kind` text DEFAULT 'rsvp' NOT NULL,
	`age_rule` text DEFAULT 'all' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE IF NOT EXISTS `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`position` text NOT NULL,
	`organization` text NOT NULL,
	`start` text NOT NULL,
	`end` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `extension_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`requested_by_id` text NOT NULL,
	`days` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `identity_reveals` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`target_id` text NOT NULL,
	`community_id` text,
	`requester_label` text DEFAULT '' NOT NULL,
	`target_label` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`responded_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE IF NOT EXISTS `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`meta` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text,
	`creator_id` text NOT NULL,
	`licensee_id` text NOT NULL,
	`work_title` text NOT NULL,
	`license_type` text NOT NULL,
	`option_name` text NOT NULL,
	`permitted_usage` text DEFAULT '' NOT NULL,
	`restrictions` text DEFAULT '' NOT NULL,
	`attribution` integer DEFAULT false NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`conversation_id` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`licensee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `likes` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text,
	`lender_id` text NOT NULL,
	`borrower_id` text NOT NULL,
	`item_title` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`needed_at` integer,
	`exchange_method` text DEFAULT 'campus_meetup' NOT NULL,
	`exchange_note` text DEFAULT '' NOT NULL,
	`start_at` integer,
	`due_at` integer NOT NULL,
	`counter_until` integer,
	`returned_at` integer,
	`returned_late` integer DEFAULT false NOT NULL,
	`condition_before` text DEFAULT '{}' NOT NULL,
	`condition_after` text DEFAULT '{}' NOT NULL,
	`extension_until` integer,
	`due_soon_notified` integer DEFAULT false NOT NULL,
	`overdue_notified` integer DEFAULT false NOT NULL,
	`deposit` integer,
	`conversation_id` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `campus_listings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`borrower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text,
	`type` text NOT NULL,
	`category` text DEFAULT 'activity' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`href` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE IF NOT EXISTS `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`poster_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`budget` integer,
	`type` text DEFAULT 'gig' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`lat` real,
	`lng` real,
	`remote` integer DEFAULT false NOT NULL,
	`student_friendly` integer DEFAULT false NOT NULL,
	`eligibility` text DEFAULT 'anyone' NOT NULL,
	`eligibility_campus_id` text,
	`trust_required` text DEFAULT 'standard' NOT NULL,
	`apply_by` integer,
	`event_date` integer,
	`apply_config` text DEFAULT '{}' NOT NULL,
	`roles` text DEFAULT '[]' NOT NULL,
	`engagement` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`poster_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`actor_id` text,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`title` text NOT NULL,
	`price` integer NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`variant` text DEFAULT '' NOT NULL,
	`fulfillment` text DEFAULT 'shipping' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`tracking` text DEFAULT '{}' NOT NULL,
	`protection_ends_at` integer,
	`seller_evidence` text DEFAULT '{}' NOT NULL,
	`conversation_id` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`purpose` text DEFAULT 'login' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE IF NOT EXISTS `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`channel` text NOT NULL,
	`to` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`booking_id` text,
	`order_id` text,
	`license_id` text,
	`community_id` text,
	`payer_id` text NOT NULL,
	`payee_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text DEFAULT 'stripe_connect' NOT NULL,
	`provider_ref` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `portfolio_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'image' NOT NULL,
	`media_url` text,
	`client` text DEFAULT '' NOT NULL,
	`project_id` text,
	`ai_involvement` text DEFAULT 'none' NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`image_url` text,
	`kind` text DEFAULT 'post' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`subcategory` text DEFAULT '' NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`disclosure` text DEFAULT 'unspecified' NOT NULL,
	`attested` integer DEFAULT false NOT NULL,
	`credit` text DEFAULT '' NOT NULL,
	`project_id` text,
	`booking_id` text,
	`client_confirmed` integer DEFAULT false NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `products` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`condition` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`sold` integer DEFAULT 0 NOT NULL,
	`variants` text DEFAULT '[]' NOT NULL,
	`fulfillment` text DEFAULT '["shipping"]' NOT NULL,
	`media` text DEFAULT '[]' NOT NULL,
	`return_policy` text DEFAULT '{}' NOT NULL,
	`external_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`cover_url` text,
	`cover_pos` integer DEFAULT 50 NOT NULL,
	`studio` text DEFAULT '' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`location_visibility` text DEFAULT 'city' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`county` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`lat` real,
	`lng` real,
	`primary_role` text DEFAULT '' NOT NULL,
	`additional_roles` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`service_area` text DEFAULT '25 miles' NOT NULL,
	`open_to_work` integer DEFAULT true NOT NULL,
	`available_for` text DEFAULT '[]' NOT NULL,
	`available_from` text DEFAULT '' NOT NULL,
	`work_location` text DEFAULT 'Hybrid' NOT NULL,
	`min_budget` integer,
	`collab_pref` text DEFAULT 'Either' NOT NULL,
	`hiring_enabled` integer DEFAULT true NOT NULL,
	`accept_offers` integer DEFAULT true NOT NULL,
	`accept_bookings` integer DEFAULT true NOT NULL,
	`accept_collabs` integer DEFAULT true NOT NULL,
	`who_can_message` text DEFAULT 'everyone' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`reveal_identity_mode` text DEFAULT 'keep_anonymous' NOT NULL,
	`show_location` integer DEFAULT true NOT NULL,
	`show_education` integer DEFAULT true NOT NULL,
	`show_followers` integer DEFAULT true NOT NULL,
	`show_following` integer DEFAULT true NOT NULL,
	`show_portfolio` integer DEFAULT true NOT NULL,
	`show_completed_projects` integer DEFAULT true NOT NULL,
	`show_work_performance` integer DEFAULT true NOT NULL,
	`show_availability` integer DEFAULT true NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`education` text DEFAULT '[]' NOT NULL,
	`trust_level` text DEFAULT 'standard' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `project_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`due_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`service_id` text,
	`opportunity_id` text,
	`conversation_id` text,
	`title` text NOT NULL,
	`brief` text DEFAULT '' NOT NULL,
	`amount` integer NOT NULL,
	`ai_requirement` text DEFAULT 'client-decides' NOT NULL,
	`deadline` integer,
	`state` text DEFAULT 'draft' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE IF NOT EXISTS `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`category` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`signals` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`author_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`rating` real NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS `services` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`category` text DEFAULT 'creative' NOT NULL,
	`ai_policy` text DEFAULT 'client-decides' NOT NULL,
	`trust_required` text DEFAULT 'standard' NOT NULL,
	`reach` text DEFAULT 'Remote' NOT NULL,
	`fulfillment` text DEFAULT 'project' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`media` text DEFAULT '[]' NOT NULL,
	`promoted` integer DEFAULT false NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS "users" (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`handle` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`tester_mode` text DEFAULT 'demo' NOT NULL,
	`phone` text,
	`phone_verified` integer DEFAULT false NOT NULL,
	`sms_consent` integer DEFAULT false NOT NULL,
	`notify_prefs` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`account_type` text DEFAULT 'individual' NOT NULL,
	`business_verified` integer DEFAULT false NOT NULL,
	`mfa_enabled` integer DEFAULT false NOT NULL,
	`mfa_secret` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE IF NOT EXISTS `works` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'beat' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_url` text,
	`preview_url` text,
	`preview_length` integer DEFAULT 30 NOT NULL,
	`watermarked` integer DEFAULT true NOT NULL,
	`license_options` text DEFAULT '[]' NOT NULL,
	`exclusive_license_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `app_opp_applicant` ON `applications` (`opportunity_id`,`applicant_id`);
CREATE INDEX IF NOT EXISTS `bids_listing` ON `bids` (`listing_id`,`amount`);
CREATE UNIQUE INDEX IF NOT EXISTS `blocks_pair` ON `blocks` (`blocker_id`,`blocked_id`);
CREATE INDEX IF NOT EXISTS `bookings_provider_starts` ON `bookings` (`provider_id`,`starts_at`);
CREATE INDEX IF NOT EXISTS `campus_listings_campus` ON `campus_listings` (`campus_id`,`created_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `campus_verif_user_campus` ON `campus_verifications` (`user_id`,`campus_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `campuses_slug_unique` ON `campuses` (`slug`);
CREATE INDEX IF NOT EXISTS `comments_post` ON `comments` (`post_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `communities_slug_unique` ON `communities` (`slug`);
CREATE INDEX IF NOT EXISTS `community_comments_post` ON `community_comments` (`post_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `community_mod_log_comm` ON `community_mod_log` (`community_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `community_posts_comm_created` ON `community_posts` (`community_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `conv_members_user` ON `conversation_members` (`user_id`);
CREATE INDEX IF NOT EXISTS `disputes_order` ON `disputes` (`order_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `events_slug_unique` ON `events` (`slug`);
CREATE INDEX IF NOT EXISTS `ext_project_status` ON `extension_requests` (`project_id`,`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `identity_reveals_pair` ON `identity_reveals` (`requester_id`,`target_id`);
CREATE INDEX IF NOT EXISTS `identity_reveals_target` ON `identity_reveals` (`target_id`,`status`);
CREATE INDEX IF NOT EXISTS `interactions_target` ON `interactions` (`target_type`,`target_id`);
CREATE INDEX IF NOT EXISTS `interactions_user` ON `interactions` (`user_id`,`action`);
CREATE INDEX IF NOT EXISTS `licenses_creator` ON `licenses` (`creator_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `licenses_work` ON `licenses` (`work_id`);
CREATE INDEX IF NOT EXISTS `loans_borrower` ON `loans` (`borrower_id`,`due_at`);
CREATE INDEX IF NOT EXISTS `loans_lender` ON `loans` (`lender_id`,`due_at`);
CREATE INDEX IF NOT EXISTS `messages_conv_created` ON `messages` (`conversation_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `notif_user_created` ON `notifications` (`user_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `notif_user_read` ON `notifications` (`user_id`,`read_at`);
CREATE INDEX IF NOT EXISTS `order_events_order` ON `order_events` (`order_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `orders_buyer` ON `orders` (`buyer_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `orders_seller` ON `orders` (`seller_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `otp_phone` ON `otp_codes` (`phone`,`created_at`);
CREATE INDEX IF NOT EXISTS `outbox_user` ON `outbox` (`user_id`,`created_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `password_resets_token_unique` ON `password_resets` (`token`);
CREATE INDEX IF NOT EXISTS `posts_author_created` ON `posts` (`author_id`,`created_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `profiles_user_id_unique` ON `profiles` (`user_id`);
CREATE INDEX IF NOT EXISTS `projects_client` ON `projects` (`client_id`);
CREATE INDEX IF NOT EXISTS `projects_creator` ON `projects` (`creator_id`);
CREATE INDEX IF NOT EXISTS `pwreset_user` ON `password_resets` (`user_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `reviews_project_author` ON `reviews` (`project_id`,`author_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `sessions_token_unique` ON `sessions` (`token`);
CREATE INDEX IF NOT EXISTS `sessions_user` ON `sessions` (`user_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_handle_unique` ON `users` (`handle`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_phone_unique` ON `users` (`phone`);
