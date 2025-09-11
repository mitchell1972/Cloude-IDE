CREATE TABLE sdet_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_suite_id UUID NOT NULL,
    file_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    test_type VARCHAR(50),
    tags TEXT[],
    parameters JSONB,
    expected_outcome TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);