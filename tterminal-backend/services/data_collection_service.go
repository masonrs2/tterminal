package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
	"tterminal-backend/internal/binance"
	"tterminal-backend/models"
	"tterminal-backend/repositories"
)

// DataCollectionService continuously collects fresh data from Binance
type DataCollectionService struct {
	candleRepo    *repositories.CandleRepository
	binanceClient *binance.Client
	isRunning     bool
	stopChan      chan bool
	symbols       []string
	intervals     []string
	mu            sync.RWMutex
	lastUpdate    map[string]time.Time
	errorCount    int64
	successCount  int64
	stats         *CollectionStats
}

// CollectionStats tracks data collection statistics
type CollectionStats struct {
	TotalRuns        int64     `json:"total_runs"`
	SuccessfulRuns   int64     `json:"successful_runs"`
	FailedRuns       int64     `json:"failed_runs"`
	LastRunTime      time.Time `json:"last_run_time"`
	LastSuccessTime  time.Time `json:"last_success_time"`
	LastErrorTime    time.Time `json:"last_error_time"`
	LastError        string    `json:"last_error"`
	CandlesCollected int64     `json:"candles_collected"`
	ActiveSymbols    []string  `json:"active_symbols"`
	ActiveIntervals  []string  `json:"active_intervals"`
	CollectionPeriod int       `json:"collection_period_seconds"`
	IsRunning        bool      `json:"is_running"`
	// New fields for dual-frequency collection
	MinuteCollectionPeriod   int `json:"minute_collection_period_seconds"`   // 60 seconds for 1m data
	IntervalCollectionPeriod int `json:"interval_collection_period_seconds"` // 300 seconds for 5m+ data
}

// NewDataCollectionService creates a new data collection service
func NewDataCollectionService(candleRepo *repositories.CandleRepository, binanceClient *binance.Client) *DataCollectionService {
	if candleRepo == nil {
		log.Fatalf("[DataCollectionService] CRITICAL: candleRepo cannot be nil")
	}
	if binanceClient == nil {
		log.Fatalf("[DataCollectionService] CRITICAL: binanceClient cannot be nil")
	}

	return &DataCollectionService{
		candleRepo:    candleRepo,
		binanceClient: binanceClient,
		isRunning:     false,
		stopChan:      make(chan bool),
		symbols:       []string{"BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "XRPUSDT"}, // Popular symbols
		intervals:     []string{"1m", "5m", "15m", "30m", "1h", "4h", "1d"},            // Popular intervals
		lastUpdate:    make(map[string]time.Time),
		stats: &CollectionStats{
			ActiveSymbols:            []string{"BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "XRPUSDT"},
			ActiveIntervals:          []string{"1m", "5m", "15m", "30m", "1h", "4h", "1d"},
			CollectionPeriod:         300, // 5 minutes (legacy field)
			MinuteCollectionPeriod:   60,  // 1 minute for 1m data
			IntervalCollectionPeriod: 300, // 5 minutes for 5m+ data
		},
	}
}

// Start begins the continuous data collection process
func (s *DataCollectionService) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("data collection service is already running")
	}

	s.isRunning = true
	s.stats.IsRunning = true

	log.Printf("[DataCollectionService] Starting continuous data collection for %d symbols, %d intervals",
		len(s.symbols), len(s.intervals))

	// Start the main collection loop in a goroutine
	go s.collectionLoop()

	// Start an immediate collection to populate with fresh data
	go s.runImmediateCollection()

	log.Printf("[DataCollectionService] Successfully started")
	return nil
}

// Stop stops the data collection service
func (s *DataCollectionService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return
	}

	log.Printf("[DataCollectionService] Stopping data collection service...")

	s.isRunning = false
	s.stats.IsRunning = false
	close(s.stopChan)

	log.Printf("[DataCollectionService] Stopped")
}

// collectionLoop is the main loop that continuously collects data
func (s *DataCollectionService) collectionLoop() {
	// Use different collection frequencies for different intervals
	// 1m data: collect every 1 minute for real-time accuracy
	// 5m+ data: collect every 5 minutes to avoid excessive API calls

	ticker1m := time.NewTicker(1 * time.Minute) // For 1m intervals
	ticker5m := time.NewTicker(5 * time.Minute) // For 5m+ intervals
	defer ticker1m.Stop()
	defer ticker5m.Stop()

	log.Printf("[DataCollectionService] Collection loop started - 1m data every 1 minute, 5m+ data every 5 minutes")

	for {
		select {
		case <-ticker1m.C:
			// Collect only 1-minute data for real-time accuracy
			s.collectIntervalData("1m")
		case <-ticker5m.C:
			// Collect all other intervals (5m, 15m, 30m, 1h, 4h, 1d)
			s.collectNonMinuteData()
		case <-s.stopChan:
			log.Printf("[DataCollectionService] Collection loop stopped")
			return
		}
	}
}

// runImmediateCollection runs an immediate collection when the service starts
func (s *DataCollectionService) runImmediateCollection() {
	log.Printf("[DataCollectionService] Running immediate collection to populate fresh data...")

	// EFFICIENT: Simply fetch recent historical data for all symbols/intervals
	s.fetchRecentHistoricalData()

	// Then collect current data
	s.collectAllData()
}

// fetchRecentHistoricalData fetches a declared period of recent historical data for all symbols/intervals
// This is much more efficient than complex gap detection - we simply ensure we have recent complete data
func (s *DataCollectionService) fetchRecentHistoricalData() {
	log.Printf("[DataCollectionService] Fetching recent historical data for all symbols/intervals...")

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	// Use semaphore to limit concurrent requests and respect API limits
	semaphore := make(chan struct{}, 5) // Conservative limit for historical data fetching
	var wg sync.WaitGroup

	totalCandles := 0

	for _, symbol := range s.symbols {
		for _, interval := range s.intervals {
			wg.Add(1)

			go func(sym, intv string) {
				defer wg.Done()

				// Acquire semaphore
				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				candles := s.fetchHistoricalDataForSymbolInterval(ctx, sym, intv)
				if candles > 0 {
					totalCandles += candles
					log.Printf("[DataCollectionService] Fetched %d historical candles for %s/%s", candles, sym, intv)
				}

				// Small delay to be respectful to API
				time.Sleep(200 * time.Millisecond)
			}(symbol, interval)
		}
	}

	wg.Wait()

	log.Printf("[DataCollectionService] Historical data fetch completed - %d total candles fetched", totalCandles)
}

// fetchHistoricalDataForSymbolInterval fetches historical data for a specific symbol/interval
func (s *DataCollectionService) fetchHistoricalDataForSymbolInterval(ctx context.Context, symbol, interval string) int {
	// Get the appropriate limit for this interval to ensure we have enough recent data
	limit := s.getHistoricalLimit(interval)

	log.Printf("[DataCollectionService] Fetching %d recent candles for %s/%s (most recent data)",
		limit, symbol, interval)

	// Use the regular optimized method to get the MOST RECENT data (not time range)
	// This ensures we get the latest candles up to the current time
	candles, err := s.binanceClient.GetKlinesOptimized(ctx, symbol, interval, limit)
	if err != nil {
		log.Printf("[DataCollectionService] ERROR fetching historical data for %s/%s: %v", symbol, interval, err)
		return 0
	}

	if len(candles) == 0 {
		log.Printf("[DataCollectionService] WARNING: No historical data returned for %s/%s", symbol, interval)
		return 0
	}

	log.Printf("[DataCollectionService] SUCCESS: Fetched %d candles for %s/%s (time range: %v to %v)",
		len(candles), symbol, interval,
		candles[0].OpenTime.Format("2006-01-02 15:04"),
		candles[len(candles)-1].OpenTime.Format("2006-01-02 15:04"))

	// Store in database (this will upsert, so existing data won't be duplicated)
	if err := s.candleRepo.BulkCreate(ctx, candles); err != nil {
		log.Printf("[DataCollectionService] ERROR storing historical data for %s/%s: %v", symbol, interval, err)
		return 0
	}

	log.Printf("[DataCollectionService] SUCCESS: Stored %d historical candles for %s/%s in database", len(candles), symbol, interval)
	return len(candles)
}

// getHistoricalLimit returns how many recent candles to fetch for each interval
// This ensures we have enough data for charts while getting the MOST RECENT data
func (s *DataCollectionService) getHistoricalLimit(interval string) int {
	switch interval {
	case "1m":
		return 1440 // 24 hours of 1m data (gets most recent 24 hours)
	case "5m":
		return 1000 // ~3.5 days of 5m data
	case "15m":
		return 1000 // ~10 days of 15m data
	case "30m":
		return 1000 // ~20 days of 30m data
	case "1h":
		return 1000 // ~41 days of 1h data
	case "4h":
		return 1000 // ~166 days of 4h data
	case "1d":
		return 365 // 1 year of 1d data
	default:
		return 1000 // Default
	}
}

// collectAllData collects data for all symbols and intervals
func (s *DataCollectionService) collectAllData() {
	startTime := time.Now()

	s.mu.Lock()
	s.stats.TotalRuns++
	s.stats.LastRunTime = startTime
	s.mu.Unlock()

	log.Printf("[DataCollectionService] Starting data collection run #%d", s.stats.TotalRuns)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	var totalCandlesCollected int64
	var successCount, errorCount int

	// Use semaphore to limit concurrent requests to avoid rate limiting
	semaphore := make(chan struct{}, 10) // Limit to 10 concurrent requests

	var wg sync.WaitGroup
	var resultMu sync.Mutex

	// Collect data for each symbol/interval combination
	for _, symbol := range s.symbols {
		for _, interval := range s.intervals {
			wg.Add(1)

			go func(sym, intv string) {
				defer wg.Done()

				// Acquire semaphore
				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				candles, err := s.collectDataForSymbolInterval(ctx, sym, intv)

				resultMu.Lock()
				if err != nil {
					errorCount++
					log.Printf("[DataCollectionService] ERROR collecting %s/%s: %v", sym, intv, err)
				} else {
					successCount++
					totalCandlesCollected += int64(len(candles))
					log.Printf("[DataCollectionService] SUCCESS collected %d candles for %s/%s", len(candles), sym, intv)
				}
				resultMu.Unlock()
			}(symbol, interval)
		}
	}

	// Wait for all collections to complete
	wg.Wait()

	duration := time.Since(startTime)

	// Update statistics
	s.mu.Lock()
	s.stats.CandlesCollected += totalCandlesCollected
	if errorCount == 0 {
		s.stats.SuccessfulRuns++
		s.stats.LastSuccessTime = startTime
	} else {
		s.stats.FailedRuns++
		s.stats.LastErrorTime = startTime
		s.stats.LastError = fmt.Sprintf("%d errors out of %d total operations", errorCount, successCount+errorCount)
	}
	s.mu.Unlock()

	log.Printf("[DataCollectionService] Collection run completed in %v - Success: %d, Errors: %d, Total candles: %d",
		duration, successCount, errorCount, totalCandlesCollected)
}

// collectDataForSymbolInterval collects data for a specific symbol/interval
func (s *DataCollectionService) collectDataForSymbolInterval(ctx context.Context, symbol, interval string) ([]models.Candle, error) {
	// Determine how much data to fetch based on the interval
	limit := s.getLimitForInterval(interval)

	log.Printf("[DataCollectionService] Fetching %d candles for %s/%s", limit, symbol, interval)

	// Fetch fresh data from Binance
	candles, err := s.binanceClient.GetKlinesOptimized(ctx, symbol, interval, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Binance: %w", err)
	}

	if len(candles) == 0 {
		return nil, fmt.Errorf("no candles returned from Binance")
	}

	// Store in database
	if err := s.candleRepo.BulkCreate(ctx, candles); err != nil {
		return nil, fmt.Errorf("failed to store candles in database: %w", err)
	}

	// Update last update time
	key := fmt.Sprintf("%s:%s", symbol, interval)
	s.mu.Lock()
	s.lastUpdate[key] = time.Now()
	s.mu.Unlock()

	return candles, nil
}

// getLimitForInterval returns the appropriate limit for each interval
func (s *DataCollectionService) getLimitForInterval(interval string) int {
	switch interval {
	case "1m":
		return 120 // 2 hours of 1m candles (reduced since we collect every minute)
	case "5m":
		return 500 // ~41 hours of 5m candles
	case "15m":
		return 200 // ~50 hours of 15m candles
	case "30m":
		return 100 // ~52 hours of 30m candles
	case "1h":
		return 72 // 72 hours (3 days)
	case "4h":
		return 42 // 168 hours (7 days)
	case "1d":
		return 30 // 30 days
	default:
		return 200 // Default
	}
}

// GetStats returns current collection statistics
func (s *DataCollectionService) GetStats() *CollectionStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Create a copy to avoid race conditions
	stats := *s.stats
	stats.IsRunning = s.isRunning
	return &stats
}

// AddSymbol adds a new symbol to the collection list
func (s *DataCollectionService) AddSymbol(symbol string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if symbol already exists
	for _, existing := range s.symbols {
		if existing == symbol {
			return // Already exists
		}
	}

	s.symbols = append(s.symbols, symbol)
	s.stats.ActiveSymbols = append(s.stats.ActiveSymbols, symbol)

	log.Printf("[DataCollectionService] Added symbol: %s", symbol)
}

// RemoveSymbol removes a symbol from the collection list
func (s *DataCollectionService) RemoveSymbol(symbol string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Remove from symbols slice
	for i, existing := range s.symbols {
		if existing == symbol {
			s.symbols = append(s.symbols[:i], s.symbols[i+1:]...)
			break
		}
	}

	// Remove from stats
	for i, existing := range s.stats.ActiveSymbols {
		if existing == symbol {
			s.stats.ActiveSymbols = append(s.stats.ActiveSymbols[:i], s.stats.ActiveSymbols[i+1:]...)
			break
		}
	}

	log.Printf("[DataCollectionService] Removed symbol: %s", symbol)
}

// GetLastUpdateTime returns the last update time for a symbol/interval
func (s *DataCollectionService) GetLastUpdateTime(symbol, interval string) *time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := fmt.Sprintf("%s:%s", symbol, interval)
	if lastUpdate, exists := s.lastUpdate[key]; exists {
		return &lastUpdate
	}
	return nil
}

// IsRunning returns whether the service is currently running
func (s *DataCollectionService) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isRunning
}

// CollectNow triggers an immediate data collection (useful for manual refresh)
func (s *DataCollectionService) CollectNow() {
	if !s.isRunning {
		log.Printf("[DataCollectionService] Cannot collect now - service is not running")
		return
	}

	log.Printf("[DataCollectionService] Manual collection triggered")
	go s.collectAllData()
}

// collectIntervalData collects data for a specific interval only
func (s *DataCollectionService) collectIntervalData(targetInterval string) {
	startTime := time.Now()

	s.mu.Lock()
	s.stats.TotalRuns++
	s.stats.LastRunTime = startTime
	s.mu.Unlock()

	log.Printf("[DataCollectionService] Starting %s data collection run #%d", targetInterval, s.stats.TotalRuns)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	var totalCandlesCollected int64
	var successCount, errorCount int

	// Use semaphore to limit concurrent requests
	semaphore := make(chan struct{}, 10)
	var wg sync.WaitGroup
	var resultMu sync.Mutex

	// Collect data for all symbols with the target interval
	for _, symbol := range s.symbols {
		wg.Add(1)

		go func(sym string) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			candles, err := s.collectDataForSymbolInterval(ctx, sym, targetInterval)

			resultMu.Lock()
			if err != nil {
				errorCount++
				log.Printf("[DataCollectionService] ERROR collecting %s/%s: %v", sym, targetInterval, err)
			} else {
				successCount++
				totalCandlesCollected += int64(len(candles))
				log.Printf("[DataCollectionService] SUCCESS collected %d candles for %s/%s", len(candles), sym, targetInterval)
			}
			resultMu.Unlock()
		}(symbol)
	}

	// Wait for all collections to complete
	wg.Wait()

	duration := time.Since(startTime)

	// Update statistics
	s.mu.Lock()
	s.stats.CandlesCollected += totalCandlesCollected
	if errorCount == 0 {
		s.stats.SuccessfulRuns++
		s.stats.LastSuccessTime = startTime
	} else {
		s.stats.FailedRuns++
		s.stats.LastErrorTime = startTime
		s.stats.LastError = fmt.Sprintf("%d errors out of %d total operations", errorCount, successCount+errorCount)
	}
	s.mu.Unlock()

	log.Printf("[DataCollectionService] %s collection completed in %v - Success: %d, Errors: %d, Total candles: %d",
		targetInterval, duration, successCount, errorCount, totalCandlesCollected)
}

// collectNonMinuteData collects data for all intervals except 1m
func (s *DataCollectionService) collectNonMinuteData() {
	nonMinuteIntervals := []string{"5m", "15m", "30m", "1h", "4h", "1d"}

	for _, interval := range nonMinuteIntervals {
		s.collectIntervalData(interval)
		time.Sleep(500 * time.Millisecond) // Small delay between intervals to avoid rate limiting
	}
}
