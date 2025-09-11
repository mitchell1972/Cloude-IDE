CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    execution_time_minutes INTEGER DEFAULT 0,
    storage_usage_mb DECIMAL DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    projects_created INTEGER DEFAULT 0,
    files_created INTEGER DEFAULT 0,
    collaboration_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id,
    date)
);