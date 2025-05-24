package services

import (
	"context"
	"fmt"
	"sync"
	"time"
	"tterminal-backend/internal/binance"
	"tterminal-backend/models"
	"tterminal-backend/repositories"
)

// CandleService handles business logic for candles with ultra-fast performance
type CandleService struct {
	candleRepo    *repositories.CandleRepository
	binanceClient *binance.Client
	cache         map[string]*models.CandleResponse // In-memory cache for ultra-fast access
	cacheMutex    sync.RWMutex
	cacheExpiry   map[string]time.Time
}

// NewCandleService creates a new ultra-fast candle service
func NewCandleService(candleRepo *repositories.CandleRepository, binanceClient *binance.Client) *CandleService {
	return &CandleService{
		candleRepo:    candleRepo,
		binanceClient: binanceClient,
		cache:         make(map[string]*models.CandleResponse),
		cacheExpiry:   make(map[string]time.Time),
	}
}

// GetOptimizedCandles retrieves candles optimized for ultra-fast frontend rendering
func (s *CandleService) GetOptimizedCandles(ctx context.Context, symbol, interval string, limit int) (*models.CandleResponse, error) {
	// Check cache first for immediate response
	cacheKey := fmt.Sprintf("%s:%s:%d", symbol, interval, limit)
	if cached := s.getCachedResponse(cacheKey); cached != nil {
		return cached, nil
	}

	// Try to get from database first
	candles, err := s.candleRepo.GetBySymbolAndInterval(ctx, symbol, interval, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get candles from database: %w", err)
	}

	// If no data in database or data is stale, fetch from Binance
	if len(candles) == 0 || s.isDataStale(candles, interval) {
		freshCandles, err := s.fetchFromBinanceAndStore(ctx, symbol, interval, limit)
		if err != nil {
			// If Binance fails but we have some data, return what we have
			if len(candles) > 0 {
				response := models.NewOptimizedResponse(symbol, interval, candles)
				s.setCachedResponse(cacheKey, response, 30*time.Second) // Short cache for stale data
				return response, nil
			}
			return nil, fmt.Errorf("failed to fetch from Binance: %w", err)
		}
		candles = freshCandles
	}

	// Create optimized response for ultra-fast transmission
	response := models.NewOptimizedResponse(symbol, interval, candles)

	// Cache for ultra-fast subsequent requests
	cacheDuration := s.getCacheDuration(interval)
	s.setCachedResponse(cacheKey, response, cacheDuration)

	return response, nil
}

// fetchFromBinanceAndStore fetches fresh data from Binance and stores it
func (s *CandleService) fetchFromBinanceAndStore(ctx context.Context, symbol, interval string, limit int) ([]models.Candle, error) {
	// Fetch from Binance with optimized parameters
	candles, err := s.binanceClient.GetKlines(symbol, interval, limit, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Binance: %w", err)
	}

	// Store in database asynchronously for performance
	go func() {
		storeCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := s.candleRepo.BulkCreate(storeCtx, candles); err != nil {
			// Log error but don't fail the main request
			fmt.Printf("Warning: failed to store candles in database: %v\n", err)
		}
	}()

	return candles, nil
}

// getCachedResponse gets response from in-memory cache with expiry check
func (s *CandleService) getCachedResponse(key string) *models.CandleResponse {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()

	response, exists := s.cache[key]
	if !exists {
		return nil
	}

	expiry, hasExpiry := s.cacheExpiry[key]
	if hasExpiry && time.Now().After(expiry) {
		// Cache expired, will be cleaned up later
		return nil
	}

	return response
}

// setCachedResponse sets response in in-memory cache with expiry
func (s *CandleService) setCachedResponse(key string, response *models.CandleResponse, duration time.Duration) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	s.cache[key] = response
	s.cacheExpiry[key] = time.Now().Add(duration)
}

// getCacheDuration returns optimal cache duration based on interval
func (s *CandleService) getCacheDuration(interval string) time.Duration {
	switch interval {
	case "1m":
		return 30 * time.Second // Very short for real-time feel
	case "5m":
		return 2 * time.Minute
	case "15m":
		return 5 * time.Minute
	case "1h":
		return 15 * time.Minute
	case "4h":
		return 1 * time.Hour
	case "1d":
		return 4 * time.Hour
	default:
		return 5 * time.Minute
	}
}

// isDataStale checks if the data is too old for the given interval
func (s *CandleService) isDataStale(candles []models.Candle, interval string) bool {
	if len(candles) == 0 {
		return true
	}

	latestCandle := candles[0] // Assuming sorted by time desc
	staleDuration := s.getStaleDuration(interval)

	return time.Since(latestCandle.OpenTime) > staleDuration
}

// getStaleDuration returns when data should be considered stale
func (s *CandleService) getStaleDuration(interval string) time.Duration {
	switch interval {
	case "1m":
		return 2 * time.Minute
	case "5m":
		return 10 * time.Minute
	case "15m":
		return 30 * time.Minute
	case "1h":
		return 2 * time.Hour
	case "4h":
		return 8 * time.Hour
	case "1d":
		return 2 * 24 * time.Hour
	default:
		return 1 * time.Hour
	}
}

// GetOptimizedCandlesJSON returns pre-serialized JSON for maximum speed
func (s *CandleService) GetOptimizedCandlesJSON(ctx context.Context, symbol, interval string, limit int) ([]byte, error) {
	response, err := s.GetOptimizedCandles(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}

	return response.ToMinimalJSON()
}

// EXISTING METHODS (keeping for backward compatibility)

// CreateCandle creates a new candle
func (s *CandleService) CreateCandle(ctx context.Context, candle *models.Candle) error {
	// Validate candle data
	if err := s.validateCandle(candle); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	return s.candleRepo.Create(ctx, candle)
}

// GetCandles retrieves candles for a symbol and interval
func (s *CandleService) GetCandles(ctx context.Context, symbol, interval string, limit int) ([]models.Candle, error) {
	// Validate inputs
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if interval == "" {
		return nil, fmt.Errorf("interval is required")
	}
	if limit <= 0 || limit > 1500 {
		limit = 100 // Default limit
	}

	return s.candleRepo.GetBySymbolAndInterval(ctx, symbol, interval, limit)
}

// GetLatestCandle retrieves the latest candle for a symbol and interval
func (s *CandleService) GetLatestCandle(ctx context.Context, symbol, interval string) (*models.Candle, error) {
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if interval == "" {
		return nil, fmt.Errorf("interval is required")
	}

	return s.candleRepo.GetLatest(ctx, symbol, interval)
}

// GetCandleRange retrieves candles within a time range
func (s *CandleService) GetCandleRange(ctx context.Context, symbol, interval string, startTime, endTime time.Time) ([]models.Candle, error) {
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if interval == "" {
		return nil, fmt.Errorf("interval is required")
	}
	if startTime.After(endTime) {
		return nil, fmt.Errorf("start time must be before end time")
	}

	return s.candleRepo.GetByTimeRange(ctx, symbol, interval, startTime, endTime)
}

// BulkCreateCandles creates multiple candles efficiently
func (s *CandleService) BulkCreateCandles(ctx context.Context, candles []models.Candle) error {
	if len(candles) == 0 {
		return nil
	}

	// Validate all candles
	for i, candle := range candles {
		if err := s.validateCandle(&candle); err != nil {
			return fmt.Errorf("validation failed for candle %d: %w", i, err)
		}
	}

	return s.candleRepo.BulkCreate(ctx, candles)
}

// GetCandleStats returns statistics for candles
func (s *CandleService) GetCandleStats(ctx context.Context, symbol, interval string, limit int) (*models.CandleStats, error) {
	candles, err := s.GetCandles(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}

	if len(candles) == 0 {
		return &models.CandleStats{
			Symbol:   symbol,
			Interval: interval,
			Count:    0,
		}, nil
	}

	// Calculate basic statistics
	stats := &models.CandleStats{
		Symbol:    symbol,
		Interval:  interval,
		Count:     len(candles),
		StartTime: candles[len(candles)-1].OpenTime, // Oldest
		EndTime:   candles[0].OpenTime,              // Most recent
	}

	return stats, nil
}

// CleanupCache removes expired cache entries (call periodically)
func (s *CandleService) CleanupCache() {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	now := time.Now()
	for key, expiry := range s.cacheExpiry {
		if now.After(expiry) {
			delete(s.cache, key)
			delete(s.cacheExpiry, key)
		}
	}
}

// validateCandle validates candle data
func (s *CandleService) validateCandle(candle *models.Candle) error {
	if candle.Symbol == "" {
		return fmt.Errorf("symbol is required")
	}
	if candle.Interval == "" {
		return fmt.Errorf("interval is required")
	}
	if candle.OpenTime.IsZero() {
		return fmt.Errorf("open time is required")
	}
	if candle.CloseTime.IsZero() {
		return fmt.Errorf("close time is required")
	}
	if candle.OpenTime.After(candle.CloseTime) {
		return fmt.Errorf("open time must be before close time")
	}

	return nil
}

// GetBySymbolAndInterval retrieves candles for a symbol and interval (alias for GetCandles)
func (s *CandleService) GetBySymbolAndInterval(ctx context.Context, symbol, interval string, limit int) ([]models.Candle, error) {
	return s.GetCandles(ctx, symbol, interval, limit)
}

// GetByTimeRange retrieves candles within a time range
func (s *CandleService) GetByTimeRange(ctx context.Context, symbol, interval string, startTime, endTime time.Time) ([]models.Candle, error) {
	return s.candleRepo.GetByTimeRange(ctx, symbol, interval, startTime, endTime)
}
