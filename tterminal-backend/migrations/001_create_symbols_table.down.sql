-- Drop indexes
DROP INDEX IF EXISTS idx_symbols_quote_asset;
DROP INDEX IF EXISTS idx_symbols_base_asset;
DROP INDEX IF EXISTS idx_symbols_is_active;
DROP INDEX IF EXISTS idx_symbols_symbol;
 
-- Drop symbols table
DROP TABLE IF EXISTS symbols; 