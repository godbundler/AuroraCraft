CREATE TYPE "public"."project_visibility" AS ENUM('public', 'private');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "visibility" "project_visibility" DEFAULT 'private' NOT NULL;