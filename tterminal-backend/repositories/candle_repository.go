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
		FROM (
			SELECT id, symbol, open_time, open, high, low, close, volume, close_time,
			       quote_asset_volume, trade_count, taker_buy_base_asset_volume,
			       taker_buy_quote_asset_volume, interval, created_at, updated_at
			FROM candles
			WHERE symbol = $1 AND interval = $2
			ORDER BY open_time DESC
			LIMIT $3
		) AS recent_candles
		ORDER BY open_time ASC
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

// GetOptimizedCandleData returns minimal candle data for ultra-fast frontend rendering
func (r *CandleRepository) GetOptimizedCandleData(ctx context.Context, symbol, interval string, limit int) ([]models.OptimizedCandle, error) {
	query := `
		SELECT open_time, open, high, low, close, volume
		FROM (
			SELECT open_time, open, high, low, close, volume
			FROM candles
			WHERE symbol = $1 AND interval = $2
			ORDER BY open_time DESC
			LIMIT $3
		) AS recent_candles
		ORDER BY open_time ASC
	`

	rows, err := r.db.Pool.Query(ctx, query, symbol, interval, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get optimized candles: %w", err)
	}
	defer rows.Close()

	// Pre-allocate slice for performance
	candles := make([]models.OptimizedCandle, 0, limit)

	for rows.Next() {
		var openTime time.Time
		var open, high, low, close, volume string

		err := rows.Scan(&openTime, &open, &high, &low, &close, &volume)
		if err != nil {
			return nil, fmt.Errorf("failed to scan optimized candle: %w", err)
		}

		// Convert to optimized format
		candles = append(candles, models.OptimizedCandle{
			T: openTime.UnixMilli(),
			O: models.ParseFloat(open),
			H: models.ParseFloat(high),
			L: models.ParseFloat(low),
			C: models.ParseFloat(close),
			V: models.ParseFloat(volume),
		})
	}

	return candles, nil
}

// BulkCreateOptimized performs ultra-fast bulk inserts using pgx copy protocol
func (r *CandleRepository) BulkCreateOptimized(ctx context.Context, candles []models.Candle) error {
	if len(candles) == 0 {
		return nil
	}

	// Use COPY for maximum insert performance (10x faster than INSERT)
	copyCount, err := r.db.Pool.CopyFrom(
		ctx,
		pgx.Identifier{"candles"},
		[]string{"symbol", "open_time", "open", "high", "low", "close", "volume",
			"close_time", "quote_asset_volume", "trade_count",
			"taker_buy_base_asset_volume", "taker_buy_quote_asset_volume",
			"interval", "created_at", "updated_at"},
		pgx.CopyFromSlice(len(candles), func(i int) ([]interface{}, error) {
			candle := candles[i]
			now := time.Now()
			return []interface{}{
				candle.Symbol, candle.OpenTime, candle.Open, candle.High, candle.Low,
				candle.Close, candle.Volume, candle.CloseTime, candle.QuoteAssetVolume,
				candle.TradeCount, candle.TakerBuyBaseAssetVolume, candle.TakerBuyQuoteAssetVolume,
				candle.Interval, now, now,
			}, nil
		}),
	)

	if err != nil {
		return fmt.Errorf("failed to bulk insert candles: %w", err)
	}

	if copyCount != int64(len(candles)) {
		return fmt.Errorf("expected to insert %d candles, inserted %d", len(candles), copyCount)
	}

	return nil
}

// GetVolumeProfileData returns aggregated price/volume data for ultra-fast volume profiles
func (r *CandleRepository) GetVolumeProfileData(ctx context.Context, symbol string, startTime, endTime time.Time) ([]VolumeProfileRow, error) {
	query := `
		WITH price_ranges AS (
			SELECT 
				symbol,
				open_time,
				(high::numeric + low::numeric) / 2 as mid_price,
				volume::numeric as vol,
				high::numeric,
				low::numeric
			FROM candles 
			WHERE symbol = $1 
			AND open_time >= $2 
			AND open_time <= $3
		),
		price_buckets AS (
			SELECT 
				ROUND(mid_price, 2) as price_level,
				SUM(vol) as total_volume,
				COUNT(*) as candle_count
			FROM price_ranges
			GROUP BY ROUND(mid_price, 2)
		)
		SELECT price_level, total_volume, candle_count
		FROM price_buckets 
		ORDER BY total_volume DESC
		LIMIT 1000
	`

	rows, err := r.db.Pool.Query(ctx, query, symbol, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume profile data: %w", err)
	}
	defer rows.Close()

	var results []VolumeProfileRow
	for rows.Next() {
		var row VolumeProfileRow
		err := rows.Scan(&row.PriceLevel, &row.Volume, &row.CandleCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan volume profile row: %w", err)
		}
		results = append(results, row)
	}

	return results, nil
}

// GetCandleAggregates returns pre-calculated aggregates for ultra-fast responses
func (r *CandleRepository) GetCandleAggregates(ctx context.Context, symbol, interval string, groupSize int) ([]CandleAggregate, error) {
	query := `
		WITH ranked_candles AS (
			SELECT 
				symbol, interval, open_time, open, high, low, close, volume,
				ROW_NUMBER() OVER (ORDER BY open_time DESC) as rn
			FROM candles 
			WHERE symbol = $1 AND interval = $2
			ORDER BY open_time DESC
			LIMIT $3
		),
		grouped_candles AS (
			SELECT 
				symbol, interval,
				FIRST_VALUE(open_time) OVER (PARTITION BY (rn-1)/$4 ORDER BY open_time DESC) as group_time,
				FIRST_VALUE(open) OVER (PARTITION BY (rn-1)/$4 ORDER BY open_time DESC) as group_open,
				MAX(high::numeric) OVER (PARTITION BY (rn-1)/$4) as group_high,
				MIN(low::numeric) OVER (PARTITION BY (rn-1)/$4) as group_low,
				LAST_VALUE(close) OVER (PARTITION BY (rn-1)/$4 ORDER BY open_time DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as group_close,
				SUM(volume::numeric) OVER (PARTITION BY (rn-1)/$4) as group_volume,
				(rn-1)/$4 as group_id
			FROM ranked_candles
		)
		SELECT DISTINCT 
			group_time, group_open, group_high, group_low, group_close, group_volume
		FROM grouped_candles 
		ORDER BY group_time DESC
	`

	rows, err := r.db.Pool.Query(ctx, query, symbol, interval, groupSize*50, groupSize)
	if err != nil {
		return nil, fmt.Errorf("failed to get candle aggregates: %w", err)
	}
	defer rows.Close()

	var aggregates []CandleAggregate
	for rows.Next() {
		var agg CandleAggregate
		err := rows.Scan(&agg.Time, &agg.Open, &agg.High, &agg.Low, &agg.Close, &agg.Volume)
		if err != nil {
			return nil, fmt.Errorf("failed to scan candle aggregate: %w", err)
		}
		aggregates = append(aggregates, agg)
	}

	return aggregates, nil
}

// Helper types for aggregated queries
type VolumeProfileRow struct {
	PriceLevel  float64
	Volume      float64
	CandleCount int
}

type CandleAggregate struct {
	Time   time.Time
	Open   string
	High   float64
	Low    float64
	Close  string
	Volume float64
}
