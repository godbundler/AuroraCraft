ALTER TABLE "agent_messages" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "opencode_session_id" varchar(255);