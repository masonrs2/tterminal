-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create a user for the application if needed
-- Note: The main user is already created by the container

-- Set timezone
SET timezone = 'UTC';

-- Create any additional extensions we might need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log that initialization is complete
SELECT 'TimescaleDB initialization completed' as status; 