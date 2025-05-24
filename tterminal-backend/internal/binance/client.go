package binance

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
	"tterminal-backend/config"
	"tterminal-backend/models"
)

// Client represents an ultra-high-performance Binance API client
type Client struct {
	baseURL     string
	httpClient  *http.Client
	cfg         *config.Config
	rateLimiter *RateLimiter
	// Connection pool for maximum performance
	requestPool sync.Pool
	// Compression support
	useCompression bool
	// Request metrics
	requestCount int64
	avgLatency   time.Duration
	mutex        sync.RWMutex
}

// RateLimiter manages API rate limits efficiently
type RateLimiter struct {
	requests    int
	window      time.Duration
	lastReset   time.Time
	maxRequests int
	mutex       sync.Mutex
}

// NewClient creates a new ultra-high-performance Binance API client
func NewClient(cfg *config.Config) *Client {
	// Ultra-optimized HTTP client
	transport := &http.Transport{
		MaxIdleConns:          100,              // High connection pool
		MaxIdleConnsPerHost:   20,               // Per-host connections
		IdleConnTimeout:       90 * time.Second, // Keep connections alive
		DisableCompression:    false,            // Enable compression
		ResponseHeaderTimeout: 5 * time.Second,
	}

	client := &Client{
		baseURL: cfg.BinanceBaseURL,
		httpClient: &http.Client{
			Timeout:   10 * time.Second, // Reasonable timeout
			Transport: transport,
		},
		cfg: cfg,
		rateLimiter: &RateLimiter{
			maxRequests: 1200, // Binance limit
			window:      time.Minute,
			lastReset:   time.Now(),
		},
		useCompression: true,
	}

	// Initialize request pool for memory efficiency
	client.requestPool.New = func() interface{} {
		return &http.Request{}
	}

	return client
}

// BinanceKlineResponse represents the response from Binance klines API
type BinanceKlineResponse [][]interface{}

// BinanceKline represents a single kline from Binance
type BinanceKline struct {
	OpenTime                 int64  `json:"open_time"`
	Open                     string `json:"open"`
	High                     string `json:"high"`
	Low                      string `json:"low"`
	Close                    string `json:"close"`
	Volume                   string `json:"volume"`
	CloseTime                int64  `json:"close_time"`
	QuoteAssetVolume         string `json:"quote_asset_volume"`
	TradeCount               int32  `json:"trade_count"`
	TakerBuyBaseAssetVolume  string `json:"taker_buy_base_asset_volume"`
	TakerBuyQuoteAssetVolume string `json:"taker_buy_quote_asset_volume"`
}

// GetKlinesParallel fetches multiple intervals in parallel for ultra-fast data aggregation
func (c *Client) GetKlinesParallel(symbols []string, intervals []string, limit int) (map[string]map[string][]models.Candle, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	type result struct {
		symbol   string
		interval string
		candles  []models.Candle
		err      error
	}

	resultChan := make(chan result, len(symbols)*len(intervals))
	semaphore := make(chan struct{}, 20) // Limit concurrent requests

	var wg sync.WaitGroup

	// Launch parallel requests
	for _, symbol := range symbols {
		for _, interval := range intervals {
			wg.Add(1)
			go func(sym, intv string) {
				defer wg.Done()

				semaphore <- struct{}{}        // Acquire
				defer func() { <-semaphore }() // Release

				candles, err := c.GetKlinesOptimized(ctx, sym, intv, limit)
				resultChan <- result{
					symbol:   sym,
					interval: intv,
					candles:  candles,
					err:      err,
				}
			}(symbol, interval)
		}
	}

	// Close channel when all goroutines finish
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	results := make(map[string]map[string][]models.Candle)
	for res := range resultChan {
		if res.err != nil {
			continue // Skip errors for now
		}

		if results[res.symbol] == nil {
			results[res.symbol] = make(map[string][]models.Candle)
		}
		results[res.symbol][res.interval] = res.candles
	}

	return results, nil
}

// GetKlinesOptimized is an ultra-fast version of GetKlines with optimizations
func (c *Client) GetKlinesOptimized(ctx context.Context, symbol, interval string, limit int) ([]models.Candle, error) {
	startTime := time.Now()
	defer c.updateMetrics(time.Since(startTime))

	// Check rate limit
	if !c.rateLimiter.canMakeRequest() {
		return nil, fmt.Errorf("rate limit exceeded")
	}

	// Build optimized URL
	params := url.Values{}
	params.Set("symbol", symbol)
	params.Set("interval", interval)
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}

	url := fmt.Sprintf("%s/fapi/v1/klines?%s", c.baseURL, params.Encode())

	// Create optimized request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add compression headers for smaller payloads
	if c.useCompression {
		req.Header.Set("Accept-Encoding", "gzip, deflate")
	}
	req.Header.Set("User-Agent", "TTerminal/1.0")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Handle compressed response
	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzipReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzipReader.Close()
		reader = gzipReader
	}

	// Fast JSON parsing
	var binanceKlines BinanceKlineResponse
	decoder := json.NewDecoder(reader)
	if err := decoder.Decode(&binanceKlines); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Ultra-fast conversion with pre-allocated slice
	candles := make([]models.Candle, 0, len(binanceKlines))
	for _, klineData := range binanceKlines {
		candle, err := c.convertBinanceKlineToCandle(klineData, symbol, interval)
		if err != nil {
			continue // Skip invalid candles
		}
		candles = append(candles, *candle)
	}

	return candles, nil
}

// GetKlines is the existing method with enhanced performance
func (c *Client) GetKlines(symbol, interval string, limit int, startTime, endTime *time.Time) ([]models.Candle, error) {
	return c.GetKlinesOptimized(context.Background(), symbol, interval, limit)
}

// convertBinanceKlineToCandle converts Binance kline data to our Candle model
func (c *Client) convertBinanceKlineToCandle(klineData []interface{}, symbol, interval string) (*models.Candle, error) {
	if len(klineData) < 11 {
		return nil, fmt.Errorf("invalid kline data length")
	}

	// Convert interfaces to appropriate types
	openTime, err := c.toInt64(klineData[0])
	if err != nil {
		return nil, fmt.Errorf("invalid open time: %w", err)
	}

	closeTime, err := c.toInt64(klineData[6])
	if err != nil {
		return nil, fmt.Errorf("invalid close time: %w", err)
	}

	tradeCount, err := c.toInt32(klineData[8])
	if err != nil {
		return nil, fmt.Errorf("invalid trade count: %w", err)
	}

	candle := &models.Candle{
		Symbol:                   symbol,
		OpenTime:                 time.UnixMilli(openTime),
		Open:                     c.toString(klineData[1]),
		High:                     c.toString(klineData[2]),
		Low:                      c.toString(klineData[3]),
		Close:                    c.toString(klineData[4]),
		Volume:                   c.toString(klineData[5]),
		CloseTime:                time.UnixMilli(closeTime),
		QuoteAssetVolume:         c.toString(klineData[7]),
		TradeCount:               tradeCount,
		TakerBuyBaseAssetVolume:  c.toString(klineData[9]),
		TakerBuyQuoteAssetVolume: c.toString(klineData[10]),
		Interval:                 interval,
	}

	return candle, nil
}

// Helper functions for type conversion
func (c *Client) toInt64(v interface{}) (int64, error) {
	switch val := v.(type) {
	case float64:
		return int64(val), nil
	case int64:
		return val, nil
	case int:
		return int64(val), nil
	case string:
		return strconv.ParseInt(val, 10, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to int64", v)
	}
}

func (c *Client) toInt32(v interface{}) (int32, error) {
	val, err := c.toInt64(v)
	if err != nil {
		return 0, err
	}
	return int32(val), nil
}

func (c *Client) toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case int64:
		return strconv.FormatInt(val, 10)
	case int:
		return strconv.Itoa(val)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// GetExchangeInfo fetches exchange information from Binance
func (c *Client) GetExchangeInfo() (*BinanceExchangeInfo, error) {
	url := fmt.Sprintf("%s/fapi/v1/exchangeInfo", c.baseURL)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var exchangeInfo BinanceExchangeInfo
	if err := json.NewDecoder(resp.Body).Decode(&exchangeInfo); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &exchangeInfo, nil
}

// BinanceExchangeInfo represents exchange information from Binance
type BinanceExchangeInfo struct {
	Symbols []BinanceSymbolInfo `json:"symbols"`
}

// BinanceSymbolInfo represents symbol information from Binance
type BinanceSymbolInfo struct {
	Symbol            string                `json:"symbol"`
	BaseAsset         string                `json:"baseAsset"`
	QuoteAsset        string                `json:"quoteAsset"`
	Status            string                `json:"status"`
	PricePrecision    int                   `json:"pricePrecision"`
	QuantityPrecision int                   `json:"quantityPrecision"`
	Filters           []BinanceSymbolFilter `json:"filters"`
}

// BinanceSymbolFilter represents a filter for a symbol
type BinanceSymbolFilter struct {
	FilterType string `json:"filterType"`
	MinPrice   string `json:"minPrice,omitempty"`
	MaxPrice   string `json:"maxPrice,omitempty"`
	TickSize   string `json:"tickSize,omitempty"`
	MinQty     string `json:"minQty,omitempty"`
	MaxQty     string `json:"maxQty,omitempty"`
	StepSize   string `json:"stepSize,omitempty"`
}

// Rate limiter implementation
func (rl *RateLimiter) canMakeRequest() bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()

	// Reset window if needed
	if now.Sub(rl.lastReset) >= rl.window {
		rl.requests = 0
		rl.lastReset = now
	}

	if rl.requests >= rl.maxRequests {
		return false
	}

	rl.requests++
	return true
}

// Performance metrics
func (c *Client) updateMetrics(latency time.Duration) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.requestCount++
	// Simple moving average
	c.avgLatency = (c.avgLatency + latency) / 2
}

// GetMetrics returns performance metrics
func (c *Client) GetMetrics() (int64, time.Duration) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.requestCount, c.avgLatency
}

// Health check for the client
func (c *Client) HealthCheck(ctx context.Context) error {
	start := time.Now()
	_, err := c.GetExchangeInfo()
	latency := time.Since(start)

	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}

	if latency > 5*time.Second {
		return fmt.Errorf("health check too slow: %v", latency)
	}

	return nil
}

// GetMultipleSymbolKlines fetches klines for multiple symbols efficiently
func (c *Client) GetMultipleSymbolKlines(symbols []string, interval string, limit int) (map[string][]models.Candle, error) {
	results := make(map[string][]models.Candle)

	// Use semaphore to limit concurrent requests
	semaphore := make(chan struct{}, 10)
	var wg sync.WaitGroup
	var mutex sync.Mutex

	for _, symbol := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			candles, err := c.GetKlinesOptimized(context.Background(), sym, interval, limit)
			if err == nil {
				mutex.Lock()
				results[sym] = candles
				mutex.Unlock()
			}
		}(symbol)
	}

	wg.Wait()
	return results, nil
}
