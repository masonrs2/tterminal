-- Create candles table
CREATE TABLE IF NOT EXISTS candles (
    id BIGSERIAL,
    symbol VARCHAR(50) NOT NULL,
    open_time TIMESTAMPTZ NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    close_time TIMESTAMPTZ NOT NULL,
    quote_asset_volume DECIMAL(20,8) NOT NULL,
    trade_count INTEGER NOT NULL,
    taker_buy_base_asset_volume DECIMAL(20,8) NOT NULL,
    taker_buy_quote_asset_volume DECIMAL(20,8) NOT NULL,
    interval VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, open_time)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('candles', 'open_time', chunk_time_interval => INTERVAL '1 day');

-- Create unique constraint on symbol, open_time, interval for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_symbol_time_interval 
ON candles(symbol, open_time, interval);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candles_symbol ON candles(symbol);
CREATE INDEX IF NOT EXISTS idx_candles_interval ON candles(interval);
CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval ON candles(symbol, interval);
CREATE INDEX IF NOT EXISTS idx_candles_close_time ON candles(close_time DESC);

-- Create compound index for time range queries
CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval_time 
ON candles(symbol, interval, open_time DESC); 