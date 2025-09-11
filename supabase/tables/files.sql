CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    content TEXT,
    file_type VARCHAR(50),
    size_bytes INTEGER DEFAULT 0,
    user_id UUID NOT NULL,
    is_folder BOOLEAN DEFAULT FALSE,
    parent_folder_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);