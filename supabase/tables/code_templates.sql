CREATE TABLE code_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    user_id UUID NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);