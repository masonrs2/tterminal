-- Create symbols table
CREATE TABLE IF NOT EXISTS symbols (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    base_asset VARCHAR(20) NOT NULL,
    quote_asset VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'TRADING',
    is_active BOOLEAN DEFAULT true,
    price_precision INTEGER DEFAULT 8,
    quantity_precision INTEGER DEFAULT 8,
    min_price DECIMAL(20,8),
    max_price DECIMAL(20,8),
    min_qty DECIMAL(20,8),
    max_qty DECIMAL(20,8),
    step_size DECIMAL(20,8),
    tick_size DECIMAL(20,8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_symbols_symbol ON symbols(symbol);
CREATE INDEX IF NOT EXISTS idx_symbols_is_active ON symbols(is_active);
CREATE INDEX IF NOT EXISTS idx_symbols_base_asset ON symbols(base_asset);
CREATE INDEX IF NOT EXISTS idx_symbols_quote_asset ON symbols(quote_asset); 