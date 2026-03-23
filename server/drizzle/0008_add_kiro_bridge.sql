-- Add bridge column to track which AI backend a session uses
ALTER TABLE "agent_sessions" ADD COLUMN "bridge" VARCHAR(32) DEFAULT 'opencode' NOT NULL;

-- Add kiro_session_id for tracking Kiro CLI sessions
ALTER TABLE "agent_sessions" ADD COLUMN "kiro_session_id" VARCHAR(255);
