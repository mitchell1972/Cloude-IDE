CREATE TABLE sdet_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL,
    test_case_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    execution_time_ms INTEGER,
    error_message TEXT,
    stack_trace TEXT,
    output TEXT,
    assertions_passed INTEGER DEFAULT 0,
    assertions_failed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);