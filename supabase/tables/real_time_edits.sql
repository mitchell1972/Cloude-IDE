CREATE TABLE real_time_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    file_id UUID NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    operation_data JSONB NOT NULL,
    cursor_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);