package repositories

import (
	"context"
	"fmt"
	"time"
	"tterminal-backend/internal/database"
	"tterminal-backend/models"

	"github.com/jackc/pgx/v5"
)

// CandleRepository handles database operations for candles
type CandleRepository struct {
	db *database.DB
}

// NewCandleRepository creates a new candle repository
func NewCandleRepository(db *database.DB) *CandleRepository {
	return &CandleRepository{db: db}
}

// Create inserts a new candle into the database
func (r *CandleRepository) Create(ctx context.Context, candle *models.Candle) error {
	query := `
		INSERT INTO candles (symbol, open_time, open, high, low, close, volume, close_time, 
		                     quote_asset_volume, trade_count, taker_buy_base_asset_volume, 
		                     taker_buy_quote_asset_volume, interval, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id
	`
	
	now := time.Now()
	err := r.db.Pool.QueryRow(ctx, query,
		candle.Symbol, candle.OpenTime, candle.Open, candle.High, candle.Low,
		candle.Close, candle.Volume, candle.CloseTime, candle.QuoteAssetVolume,
		candle.TradeCount, candle.TakerBuyBaseAssetVolume, candle.TakerBuyQuoteAssetVolume,
		candle.Interval, now, now,
	).Scan(&candle.ID)
	
	if err != nil {
		return fmt.Errorf("failed to create candle: %w", err)
	}
	
	candle.CreatedAt = now
	candle.UpdatedAt = now
	return nil
}

// GetBySymbolAndInterval retrieves candles for a symbol and interval
func (r *CandleRepository) GetBySymbolAndInterval(ctx context.Context, symbol, interval string, limit int) ([]models.Candle, error) {
	query := `
		SELECT id, symbol, open_time, open, high, low, close, volume, close_time,
		       quote_asset_volume, trade_count, taker_buy_base_asset_volume,
		       taker_buy_quote_asset_volume, interval, created_at, updated_at
		FROM candles
		WHERE symbol = $1 AND interval = $2
		ORDER BY open_time DESC
		LIMIT $3
	`
	
	rows, err := r.db.Pool.Query(ctx, query, symbol, interval, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get candles: %w", err)
	}
	defer rows.Close()
	
	var candles []models.Candle
	for rows.Next() {
		var candle models.Candle
		err := rows.Scan(
			&candle.ID, &candle.Symbol, &candle.OpenTime, &candle.Open,
			&candle.High, &candle.Low, &candle.Close, &candle.Volume,
			&candle.CloseTime, &candle.QuoteAssetVolume, &candle.TradeCount,
			&candle.TakerBuyBaseAssetVolume, &candle.TakerBuyQuoteAssetVolume,
			&candle.Interval, &candle.CreatedAt, &candle.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan candle: %w", err)
		}
		candles = append(candles, candle)
	}
	
	return candles, nil
}

// GetLatest retrieves the latest candle for a symbol and interval
func (r *CandleRepository) GetLatest(ctx context.Context, symbol, interval string) (*models.Candle, error) {
	query := `
		SELECT id, symbol, open_time, open, high, low, close, volume, close_time,
		       quote_asset_volume, trade_count, taker_buy_base_asset_volume,
		       taker_buy_quote_asset_volume, interval, created_at, updated_at
		FROM candles
		WHERE symbol = $1 AND interval = $2
		ORDER BY open_time DESC
		LIMIT 1
	`
	
	var candle models.Candle
	err := r.db.Pool.QueryRow(ctx, query, symbol, interval).Scan(
		&candle.ID, &candle.Symbol, &candle.OpenTime, &candle.Open,
		&candle.High, &candle.Low, &candle.Close, &candle.Volume,
		&candle.CloseTime, &candle.QuoteAssetVolume, &candle.TradeCount,
		&candle.TakerBuyBaseAssetVolume, &candle.TakerBuyQuoteAssetVolume,
		&candle.Interval, &candle.CreatedAt, &candle.UpdatedAt,
	)
	
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get latest candle: %w", err)
	}
	
	return &candle, nil
}

// GetByTimeRange retrieves candles within a time range
func (r *CandleRepository) GetByTimeRange(ctx context.Context, symbol, interval string, startTime, endTime time.Time) ([]models.Candle, error) {
	query := `
		SELECT id, symbol, open_time, open, high, low, close, volume, close_time,
		       quote_asset_volume, trade_count, taker_buy_base_asset_volume,
		       taker_buy_quote_asset_volume, interval, created_at, updated_at
		FROM candles
		WHERE symbol = $1 AND interval = $2 AND open_time >= $3 AND open_time <= $4
		ORDER BY open_time ASC
	`
	
	rows, err := r.db.Pool.Query(ctx, query, symbol, interval, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get candles by time range: %w", err)
	}
	defer rows.Close()
	
	var candles []models.Candle
	for rows.Next() {
		var candle models.Candle
		err := rows.Scan(
			&candle.ID, &candle.Symbol, &candle.OpenTime, &candle.Open,
			&candle.High, &candle.Low, &candle.Close, &candle.Volume,
			&candle.CloseTime, &candle.QuoteAssetVolume, &candle.TradeCount,
			&candle.TakerBuyBaseAssetVolume, &candle.TakerBuyQuoteAssetVolume,
			&candle.Interval, &candle.CreatedAt, &candle.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan candle: %w", err)
		}
		candles = append(candles, candle)
	}
	
	return candles, nil
}

// BulkCreate inserts multiple candles
func (r *CandleRepository) BulkCreate(ctx context.Context, candles []models.Candle) error {
	if len(candles) == 0 {
		return nil
	}
	
	batch := &pgx.Batch{}
	now := time.Now()
	
	for _, candle := range candles {
		batch.Queue(`
			INSERT INTO candles (symbol, open_time, open, high, low, close, volume, close_time, 
			                     quote_asset_volume, trade_count, taker_buy_base_asset_volume, 
			                     taker_buy_quote_asset_volume, interval, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			ON CONFLICT (symbol, open_time, interval) DO UPDATE SET
				open = EXCLUDED.open,
				high = EXCLUDED.high,
				low = EXCLUDED.low,
				close = EXCLUDED.close,
				volume = EXCLUDED.volume,
				close_time = EXCLUDED.close_time,
				quote_asset_volume = EXCLUDED.quote_asset_volume,
				trade_count = EXCLUDED.trade_count,
				taker_buy_base_asset_volume = EXCLUDED.taker_buy_base_asset_volume,
				taker_buy_quote_asset_volume = EXCLUDED.taker_buy_quote_asset_volume,
				updated_at = $15
		`,
			candle.Symbol, candle.OpenTime, candle.Open, candle.High, candle.Low,
			candle.Close, candle.Volume, candle.CloseTime, candle.QuoteAssetVolume,
			candle.TradeCount, candle.TakerBuyBaseAssetVolume, candle.TakerBuyQuoteAssetVolume,
			candle.Interval, now, now,
		)
	}
	
	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()
	
	for i := 0; i < len(candles); i++ {
		_, err := br.Exec()
		if err != nil {
			return fmt.Errorf("failed to insert candle %d: %w", i, err)
		}
	}
	
	return nil
} 