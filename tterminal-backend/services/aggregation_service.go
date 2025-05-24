package services

import (
	"context"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"
	"tterminal-backend/models"
	"tterminal-backend/pkg/cache"
)

// AggregationService handles ultra-fast data aggregation from multiple sources
type AggregationService struct {
	candleService *CandleService
	cache         *cache.RedisCache
	mu            sync.RWMutex
	// In-memory cache for ultra-fast access (LRU with TTL)
	memCache map[string]*CachedData
	// Pre-computed aggregations
	aggregations map[string]*PrecomputedAggregation
	// Background workers
	workers     int
	tickerStop  chan bool
	updateQueue chan AggregationRequest
	// Error tracking
	errorCount    int64
	lastError     error
	lastErrorTime time.Time
}

// CachedData represents cached aggregated data
type CachedData struct {
	Data      interface{}
	Timestamp time.Time
	TTL       time.Duration
	Key       string
}

// PrecomputedAggregation stores pre-calculated aggregations
type PrecomputedAggregation struct {
	Symbol        string
	Intervals     []string
	LastUpdate    time.Time
	VolumeProfile *models.VolumeProfile
	Footprint     []models.FootprintCandle
	Liquidations  []models.Liquidation
	Heatmap       *models.Heatmap
}

// AggregationRequest represents a request for data aggregation
type AggregationRequest struct {
	Symbol     string
	Interval   string
	Type       string // "candles", "volume_profile", "footprint", "liquidations"
	Priority   int    // 1=highest, 10=lowest
	Context    context.Context
	ResponseCh chan AggregationResponse
}

// AggregationResponse represents the response from aggregation
type AggregationResponse struct {
	Data  interface{}
	Error error
	Meta  map[string]interface{}
}

// NewAggregationService creates a new ultra-fast aggregation service
func NewAggregationService(candleService *CandleService, cache *cache.RedisCache) *AggregationService {
	service := &AggregationService{
		candleService: candleService,
		cache:         cache,
		memCache:      make(map[string]*CachedData),
		aggregations:  make(map[string]*PrecomputedAggregation),
		workers:       8, // Use 8 worker goroutines for parallel processing
		tickerStop:    make(chan bool),
		updateQueue:   make(chan AggregationRequest, 1000), // Buffer for 1000 requests
	}

	// Start background workers
	service.startWorkers()
	service.startAggregationUpdater()

	return service
}

// GetAggregatedCandles returns ultra-optimized candle data with detailed error handling
func (s *AggregationService) GetAggregatedCandles(ctx context.Context, symbol, interval string, limit int) (*models.CandleResponse, error) {
	log.Printf("[AggregationService] GetAggregatedCandles called: symbol=%s, interval=%s, limit=%d", symbol, interval, limit)

	// Validate inputs
	if symbol == "" {
		err := fmt.Errorf("symbol cannot be empty")
		log.Printf("[AggregationService] Validation error: %v", err)
		return nil, err
	}
	if interval == "" {
		err := fmt.Errorf("interval cannot be empty")
		log.Printf("[AggregationService] Validation error: %v", err)
		return nil, err
	}
	if limit <= 0 || limit > 5000 {
		err := fmt.Errorf("limit must be between 1 and 5000, got %d", limit)
		log.Printf("[AggregationService] Validation error: %v", err)
		return nil, err
	}

	cacheKey := fmt.Sprintf("agg:candles:%s:%s:%d", symbol, interval, limit)
	log.Printf("[AggregationService] Generated cache key: %s", cacheKey)

	// Try memory cache first (fastest)
	if cached := s.getFromMemCache(cacheKey); cached != nil {
		log.Printf("[AggregationService] Cache HIT (memory): %s", cacheKey)
		if response, ok := cached.Data.(*models.CandleResponse); ok {
			return response, nil
		} else {
			log.Printf("[AggregationService] Cache data type assertion failed, expected *models.CandleResponse, got %T", cached.Data)
		}
	} else {
		log.Printf("[AggregationService] Cache MISS (memory): %s", cacheKey)
	}

	// Try Redis cache
	var response models.CandleResponse
	if s.cache != nil {
		if err := s.cache.Get(ctx, cacheKey, &response); err == nil {
			log.Printf("[AggregationService] Cache HIT (Redis): %s", cacheKey)
			// Store in memory cache for next time
			s.setMemCache(cacheKey, &response, 30*time.Second)
			return &response, nil
		} else {
			log.Printf("[AggregationService] Cache MISS (Redis): %s, error: %v", cacheKey, err)
		}
	} else {
		log.Printf("[AggregationService] WARNING: Redis cache is nil")
	}

	// Fetch from database and optimize
	log.Printf("[AggregationService] Fetching from candle service...")
	if s.candleService == nil {
		err := fmt.Errorf("candle service is not initialized")
		log.Printf("[AggregationService] CRITICAL ERROR: %v", err)
		s.trackError(err)
		return nil, err
	}

	candles, err := s.candleService.GetBySymbolAndInterval(ctx, symbol, interval, limit)
	if err != nil {
		err = fmt.Errorf("failed to get candles from service: %w", err)
		log.Printf("[AggregationService] Service error: %v", err)
		s.trackError(err)
		return nil, err
	}

	log.Printf("[AggregationService] Retrieved %d candles from service", len(candles))

	// Convert to optimized format
	optimizedResponse := models.NewOptimizedResponse(symbol, interval, candles)
	log.Printf("[AggregationService] Created optimized response with %d candles", optimizedResponse.N)

	// Cache the result (Redis: 5min, Memory: 30sec)
	if s.cache != nil {
		if err := s.cache.Set(ctx, cacheKey, optimizedResponse, 5*time.Minute); err != nil {
			log.Printf("[AggregationService] WARNING: Failed to set Redis cache: %v", err)
		} else {
			log.Printf("[AggregationService] Cached in Redis: %s", cacheKey)
		}
	}

	s.setMemCache(cacheKey, optimizedResponse, 30*time.Second)
	log.Printf("[AggregationService] Cached in memory: %s", cacheKey)

	log.Printf("[AggregationService] Successfully returning %d candles", optimizedResponse.N)
	return optimizedResponse, nil
}

// GetVolumeProfile generates ultra-fast volume profile data
func (s *AggregationService) GetVolumeProfile(ctx context.Context, symbol string, startTime, endTime time.Time) (*models.VolumeProfile, error) {
	cacheKey := fmt.Sprintf("vp:%s:%d:%d", symbol, startTime.Unix(), endTime.Unix())

	// Check cache first
	if cached := s.getFromMemCache(cacheKey); cached != nil {
		if vp, ok := cached.Data.(*models.VolumeProfile); ok {
			return vp, nil
		}
	}

	// Check if we have precomputed data
	s.mu.RLock()
	if precomp, exists := s.aggregations[symbol]; exists &&
		precomp.VolumeProfile != nil &&
		time.Since(precomp.LastUpdate) < 5*time.Minute {
		s.mu.RUnlock()
		return precomp.VolumeProfile, nil
	}
	s.mu.RUnlock()

	// Calculate volume profile
	vp, err := s.calculateVolumeProfile(ctx, symbol, startTime, endTime)
	if err != nil {
		return nil, err
	}

	// Cache the result
	s.setMemCache(cacheKey, vp, 2*time.Minute)

	return vp, nil
}

// GetFootprintData generates footprint chart data
func (s *AggregationService) GetFootprintData(ctx context.Context, symbol, interval string, limit int) ([]models.FootprintCandle, error) {
	cacheKey := fmt.Sprintf("footprint:%s:%s:%d", symbol, interval, limit)

	// Try cache first
	if cached := s.getFromMemCache(cacheKey); cached != nil {
		if footprint, ok := cached.Data.([]models.FootprintCandle); ok {
			return footprint, nil
		}
	}

	// Generate footprint data (this would involve trade analysis)
	footprint, err := s.generateFootprintData(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}

	// Cache for 1 minute (footprint data changes frequently)
	s.setMemCache(cacheKey, footprint, time.Minute)

	return footprint, nil
}

// GetLiquidations detects and returns liquidation events
func (s *AggregationService) GetLiquidations(ctx context.Context, symbol string, timeRange time.Duration) ([]models.Liquidation, error) {
	cacheKey := fmt.Sprintf("liq:%s:%d", symbol, int(timeRange.Seconds()))

	// Check cache
	if cached := s.getFromMemCache(cacheKey); cached != nil {
		if liquidations, ok := cached.Data.([]models.Liquidation); ok {
			return liquidations, nil
		}
	}

	// Detect liquidations (analyze large volume spikes, price movements)
	liquidations, err := s.detectLiquidations(ctx, symbol, timeRange)
	if err != nil {
		return nil, err
	}

	// Cache for 30 seconds (liquidations are time-sensitive)
	s.setMemCache(cacheKey, liquidations, 30*time.Second)

	return liquidations, nil
}

// GetHeatmap generates price/volume heatmap
func (s *AggregationService) GetHeatmap(ctx context.Context, symbol string, startTime, endTime time.Time, resolution int) (*models.Heatmap, error) {
	cacheKey := fmt.Sprintf("heatmap:%s:%d:%d:%d", symbol, startTime.Unix(), endTime.Unix(), resolution)

	// Check cache
	if cached := s.getFromMemCache(cacheKey); cached != nil {
		if heatmap, ok := cached.Data.(*models.Heatmap); ok {
			return heatmap, nil
		}
	}

	// Generate heatmap
	heatmap, err := s.generateHeatmap(ctx, symbol, startTime, endTime, resolution)
	if err != nil {
		return nil, err
	}

	// Cache for 5 minutes
	s.setMemCache(cacheKey, heatmap, 5*time.Minute)

	return heatmap, nil
}

// PRIVATE METHODS

// Memory cache operations (ultra-fast)
func (s *AggregationService) getFromMemCache(key string) *CachedData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if cached, exists := s.memCache[key]; exists {
		if time.Since(cached.Timestamp) < cached.TTL {
			return cached
		}
		// Expired, remove it
		delete(s.memCache, key)
	}
	return nil
}

func (s *AggregationService) setMemCache(key string, data interface{}, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.memCache[key] = &CachedData{
		Data:      data,
		Timestamp: time.Now(),
		TTL:       ttl,
		Key:       key,
	}

	// Simple LRU: if cache gets too big, remove oldest entries
	if len(s.memCache) > 1000 {
		s.evictOldest()
	}
}

func (s *AggregationService) evictOldest() {
	oldest := time.Now()
	oldestKey := ""

	for key, cached := range s.memCache {
		if cached.Timestamp.Before(oldest) {
			oldest = cached.Timestamp
			oldestKey = key
		}
	}

	if oldestKey != "" {
		delete(s.memCache, oldestKey)
	}
}

// Background workers for parallel processing
func (s *AggregationService) startWorkers() {
	for i := 0; i < s.workers; i++ {
		go s.worker()
	}
}

func (s *AggregationService) worker() {
	for req := range s.updateQueue {
		var response AggregationResponse

		switch req.Type {
		case "candles":
			data, err := s.GetAggregatedCandles(req.Context, req.Symbol, req.Interval, 1000)
			response = AggregationResponse{Data: data, Error: err}
		case "volume_profile":
			data, err := s.GetVolumeProfile(req.Context, req.Symbol, time.Now().Add(-24*time.Hour), time.Now())
			response = AggregationResponse{Data: data, Error: err}
			// Add more cases as needed
		}

		select {
		case req.ResponseCh <- response:
		case <-req.Context.Done():
			// Request cancelled
		}
	}
}

// Background aggregation updater
func (s *AggregationService) startAggregationUpdater() {
	ticker := time.NewTicker(30 * time.Second) // Update every 30 seconds
	go func() {
		for {
			select {
			case <-ticker.C:
				s.updatePrecomputedAggregations()
			case <-s.tickerStop:
				ticker.Stop()
				return
			}
		}
	}()
}

func (s *AggregationService) updatePrecomputedAggregations() {
	// This would update precomputed aggregations for popular symbols
	// Implementation would involve identifying active symbols and updating their aggregations
}

// Volume profile calculation
func (s *AggregationService) calculateVolumeProfile(ctx context.Context, symbol string, startTime, endTime time.Time) (*models.VolumeProfile, error) {
	// Get candles for the time range
	candles, err := s.candleService.GetByTimeRange(ctx, symbol, "1m", startTime, endTime)
	if err != nil {
		return nil, err
	}

	// Calculate price levels and volume distribution
	priceVolume := make(map[float64]float64)
	totalVolume := 0.0

	for _, candle := range candles {
		// Parse prices and volume
		high := models.ParseFloat(candle.High)
		low := models.ParseFloat(candle.Low)
		volume := models.ParseFloat(candle.Volume)

		// Distribute volume across price range (simplified)
		priceRange := high - low
		if priceRange > 0 {
			steps := int(priceRange * 100) // Price precision
			if steps > 100 {
				steps = 100 // Limit steps
			}
			volumePerStep := volume / float64(steps)

			for i := 0; i < steps; i++ {
				price := low + (priceRange * float64(i) / float64(steps))
				priceVolume[price] += volumePerStep
				totalVolume += volumePerStep
			}
		}
	}

	// Convert to sorted levels
	levels := make([]models.VolumeProfileLevel, 0, len(priceVolume))
	for price, volume := range priceVolume {
		levels = append(levels, models.VolumeProfileLevel{
			P:   price,
			V:   volume,
			Pct: (volume / totalVolume) * 100,
		})
	}

	// Sort by volume descending
	sort.Slice(levels, func(i, j int) bool {
		return levels[i].V > levels[j].V
	})

	// Find POC (Point of Control)
	var poc float64
	if len(levels) > 0 {
		poc = levels[0].P
	}

	// Calculate Value Area (70% of volume)
	valueAreaVolume := totalVolume * 0.7
	currentVolume := 0.0
	var vah, val float64

	for _, level := range levels {
		currentVolume += level.V
		if val == 0 {
			val = level.P
		}
		vah = level.P

		if currentVolume >= valueAreaVolume {
			break
		}
	}

	return &models.VolumeProfile{
		S:   symbol,
		ST:  startTime.UnixMilli(),
		ET:  endTime.UnixMilli(),
		L:   levels,
		POC: poc,
		VAH: vah,
		VAL: val,
		VAV: 70.0,
	}, nil
}

// Footprint data generation (simplified - would need trade data)
func (s *AggregationService) generateFootprintData(ctx context.Context, symbol, interval string, limit int) ([]models.FootprintCandle, error) {
	// This is a simplified implementation
	// In reality, you'd need tick-by-tick trade data to generate accurate footprint charts

	candles, err := s.candleService.GetBySymbolAndInterval(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}

	footprintCandles := make([]models.FootprintCandle, len(candles))

	for i, candle := range candles {
		// Simulate footprint data (in real implementation, use trade data)
		volume := models.ParseFloat(candle.Volume)

		footprintCandles[i] = models.FootprintCandle{
			T:   candle.OpenTime.UnixMilli(),
			L:   []models.FootprintLevel{},      // Would be populated with real trade data
			TBV: volume * 0.6,                   // Simulated buy volume
			TSV: volume * 0.4,                   // Simulated sell volume
			TD:  volume * 0.2,                   // Simulated delta
			POC: models.ParseFloat(candle.High), // Simulated POC
		}
	}

	return footprintCandles, nil
}

// Liquidation detection (simplified)
func (s *AggregationService) detectLiquidations(ctx context.Context, symbol string, timeRange time.Duration) ([]models.Liquidation, error) {
	// This would analyze large volume spikes and rapid price movements
	// Simplified implementation for now

	endTime := time.Now()
	startTime := endTime.Add(-timeRange)

	candles, err := s.candleService.GetByTimeRange(ctx, symbol, "1m", startTime, endTime)
	if err != nil {
		return nil, err
	}

	var liquidations []models.Liquidation

	for i := 1; i < len(candles); i++ {
		current := candles[i]
		previous := candles[i-1]

		currentVolume := models.ParseFloat(current.Volume)
		previousVolume := models.ParseFloat(previous.Volume)

		// Detect volume spike (3x normal volume)
		if currentVolume > previousVolume*3 {
			liquidations = append(liquidations, models.Liquidation{
				T:    current.OpenTime.UnixMilli(),
				P:    models.ParseFloat(current.Close),
				V:    currentVolume,
				Side: "unknown", // Would determine from price movement
				Type: "single",
				Conf: 0.7, // Confidence score
			})
		}
	}

	return liquidations, nil
}

// Heatmap generation
func (s *AggregationService) generateHeatmap(ctx context.Context, symbol string, startTime, endTime time.Time, resolution int) (*models.Heatmap, error) {
	// Generate price/volume heatmap data
	candles, err := s.candleService.GetByTimeRange(ctx, symbol, "1m", startTime, endTime)
	if err != nil {
		return nil, err
	}

	cells := make([]models.HeatmapCell, 0)
	maxVolume := 0.0

	for _, candle := range candles {
		volume := models.ParseFloat(candle.Volume)
		price := models.ParseFloat(candle.Close)

		if volume > maxVolume {
			maxVolume = volume
		}

		cells = append(cells, models.HeatmapCell{
			P: price,
			T: candle.OpenTime.UnixMilli(),
			V: volume,
			I: volume / maxVolume, // Intensity normalized
		})
	}

	return &models.Heatmap{
		S:   symbol,
		ST:  startTime.UnixMilli(),
		ET:  endTime.UnixMilli(),
		L:   cells,
		Max: maxVolume,
	}, nil
}

// Stop shuts down the aggregation service
func (s *AggregationService) Stop() {
	close(s.tickerStop)
	close(s.updateQueue)
}

// trackError tracks errors for debugging
func (s *AggregationService) trackError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.errorCount++
	s.lastError = err
	s.lastErrorTime = time.Now()
}

// GetServiceStats returns service statistics for debugging
func (s *AggregationService) GetServiceStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]interface{}{
		"memory_cache_size": len(s.memCache),
		"error_count":       s.errorCount,
		"last_error":        s.lastError,
		"last_error_time":   s.lastErrorTime,
		"workers":           s.workers,
		"aggregations":      len(s.aggregations),
	}
}
