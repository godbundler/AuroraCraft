CREATE TYPE "public"."project_bridge" AS ENUM('opencode', 'kiro');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "bridge" "project_bridge" DEFAULT 'opencode' NOT NULL;
