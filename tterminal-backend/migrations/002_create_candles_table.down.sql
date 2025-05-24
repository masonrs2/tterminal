-- Drop indexes
DROP INDEX IF EXISTS idx_candles_symbol_interval_time;
DROP INDEX IF EXISTS idx_candles_close_time;
DROP INDEX IF EXISTS idx_candles_symbol_interval;
DROP INDEX IF EXISTS idx_candles_interval;
DROP INDEX IF EXISTS idx_candles_symbol;
DROP INDEX IF EXISTS idx_candles_symbol_time_interval;

-- Drop the hypertable (this will also drop the table)
DROP TABLE IF EXISTS candles; 