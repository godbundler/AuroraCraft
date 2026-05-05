-- Add CodeRabbit fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS coderabbit_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coderabbit_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coderabbit_granted_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS coderabbit_granted_at TIMESTAMP WITH TIME ZONE;

-- Create code_reviews table
CREATE TABLE IF NOT EXISTS code_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope VARCHAR(50) NOT NULL, -- 'full', 'uncommitted', 'recent'
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'passed', 'failed', 'fixed', 'pushed', 'ignored'
  issues_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_code_reviews_project ON code_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_user ON code_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_status ON code_reviews(status);
