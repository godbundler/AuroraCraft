ALTER TABLE "projects" ADD COLUMN "link_id" varchar(128);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_link_id_unique" UNIQUE("link_id");