package repositories

import (
	"context"
	"fmt"
	"time"
	"tterminal-backend/internal/database"
	"tterminal-backend/models"

	"github.com/jackc/pgx/v5"
)

// SymbolRepository handles database operations for symbols
type SymbolRepository struct {
	db *database.DB
}

// NewSymbolRepository creates a new symbol repository
func NewSymbolRepository(db *database.DB) *SymbolRepository {
	return &SymbolRepository{db: db}
}

// Create inserts a new symbol into the database
func (r *SymbolRepository) Create(ctx context.Context, symbol *models.Symbol) error {
	query := `
		INSERT INTO symbols (symbol, base_asset, quote_asset, status, is_active, 
		                     price_precision, quantity_precision, min_price, max_price,
		                     min_qty, max_qty, step_size, tick_size, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id
	`

	now := time.Now()
	// Handle NULL values for numeric fields
	var minPrice, maxPrice, minQty, maxQty, stepSize, tickSize interface{}
	if symbol.MinPrice.Valid {
		minPrice = symbol.MinPrice.String
	}
	if symbol.MaxPrice.Valid {
		maxPrice = symbol.MaxPrice.String
	}
	if symbol.MinQty.Valid {
		minQty = symbol.MinQty.String
	}
	if symbol.MaxQty.Valid {
		maxQty = symbol.MaxQty.String
	}
	if symbol.StepSize.Valid {
		stepSize = symbol.StepSize.String
	}
	if symbol.TickSize.Valid {
		tickSize = symbol.TickSize.String
	}

	err := r.db.Pool.QueryRow(ctx, query,
		symbol.Symbol, symbol.BaseAsset, symbol.QuoteAsset, symbol.Status, symbol.IsActive,
		symbol.PricePrecision, symbol.QuantityPrecision, minPrice, maxPrice,
		minQty, maxQty, stepSize, tickSize, now, now,
	).Scan(&symbol.ID)

	if err != nil {
		return fmt.Errorf("failed to create symbol: %w", err)
	}

	symbol.CreatedAt = now
	symbol.UpdatedAt = now
	return nil
}

// GetBySymbol retrieves a symbol by its symbol name
func (r *SymbolRepository) GetBySymbol(ctx context.Context, symbolName string) (*models.Symbol, error) {
	query := `
		SELECT id, symbol, base_asset, quote_asset, status, is_active,
		       price_precision, quantity_precision, min_price, max_price,
		       min_qty, max_qty, step_size, tick_size, created_at, updated_at
		FROM symbols
		WHERE symbol = $1
	`

	var symbol models.Symbol
	err := r.db.Pool.QueryRow(ctx, query, symbolName).Scan(
		&symbol.ID, &symbol.Symbol, &symbol.BaseAsset, &symbol.QuoteAsset,
		&symbol.Status, &symbol.IsActive, &symbol.PricePrecision, &symbol.QuantityPrecision,
		&symbol.MinPrice, &symbol.MaxPrice, &symbol.MinQty, &symbol.MaxQty,
		&symbol.StepSize, &symbol.TickSize, &symbol.CreatedAt, &symbol.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get symbol: %w", err)
	}

	return &symbol, nil
}

// GetAll retrieves all symbols
func (r *SymbolRepository) GetAll(ctx context.Context) ([]models.Symbol, error) {
	query := `
		SELECT id, symbol, base_asset, quote_asset, status, is_active,
		       price_precision, quantity_precision, min_price, max_price,
		       min_qty, max_qty, step_size, tick_size, created_at, updated_at
		FROM symbols
		ORDER BY symbol ASC
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get symbols: %w", err)
	}
	defer rows.Close()

	var symbols []models.Symbol
	for rows.Next() {
		var symbol models.Symbol
		err := rows.Scan(
			&symbol.ID, &symbol.Symbol, &symbol.BaseAsset, &symbol.QuoteAsset,
			&symbol.Status, &symbol.IsActive, &symbol.PricePrecision, &symbol.QuantityPrecision,
			&symbol.MinPrice, &symbol.MaxPrice, &symbol.MinQty, &symbol.MaxQty,
			&symbol.StepSize, &symbol.TickSize, &symbol.CreatedAt, &symbol.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan symbol: %w", err)
		}
		symbols = append(symbols, symbol)
	}

	return symbols, nil
}

// Update updates a symbol
func (r *SymbolRepository) Update(ctx context.Context, symbolName string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	// Build dynamic query
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	for field, value := range updates {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", field, argIndex))
		args = append(args, value)
		argIndex++
	}

	// Add updated_at
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause
	args = append(args, symbolName)

	query := fmt.Sprintf(`
		UPDATE symbols 
		SET %s
		WHERE symbol = $%d
	`, fmt.Sprintf("%s", setParts), argIndex)

	_, err := r.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update symbol: %w", err)
	}

	return nil
}

// Delete removes a symbol
func (r *SymbolRepository) Delete(ctx context.Context, symbolName string) error {
	query := `DELETE FROM symbols WHERE symbol = $1`

	result, err := r.db.Pool.Exec(ctx, query, symbolName)
	if err != nil {
		return fmt.Errorf("failed to delete symbol: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("symbol not found")
	}

	return nil
}

// GetActiveSymbols retrieves all active symbols
func (r *SymbolRepository) GetActiveSymbols(ctx context.Context) ([]models.Symbol, error) {
	query := `
		SELECT id, symbol, base_asset, quote_asset, status, is_active,
		       price_precision, quantity_precision, min_price, max_price,
		       min_qty, max_qty, step_size, tick_size, created_at, updated_at
		FROM symbols
		WHERE is_active = true
		ORDER BY symbol ASC
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get active symbols: %w", err)
	}
	defer rows.Close()

	var symbols []models.Symbol
	for rows.Next() {
		var symbol models.Symbol
		err := rows.Scan(
			&symbol.ID, &symbol.Symbol, &symbol.BaseAsset, &symbol.QuoteAsset,
			&symbol.Status, &symbol.IsActive, &symbol.PricePrecision, &symbol.QuantityPrecision,
			&symbol.MinPrice, &symbol.MaxPrice, &symbol.MinQty, &symbol.MaxQty,
			&symbol.StepSize, &symbol.TickSize, &symbol.CreatedAt, &symbol.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan symbol: %w", err)
		}
		symbols = append(symbols, symbol)
	}

	return symbols, nil
}
 