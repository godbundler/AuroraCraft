ALTER TABLE "projects" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "versions" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "layout_mode" varchar(16) DEFAULT 'chat-first' NOT NULL;