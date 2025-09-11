CREATE TABLE sdet_code_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL,
    file_id UUID NOT NULL,
    total_lines INTEGER NOT NULL,
    covered_lines INTEGER NOT NULL,
    coverage_percentage DECIMAL(5,2),
    line_coverage JSONB,
    branch_coverage JSONB,
    function_coverage JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);