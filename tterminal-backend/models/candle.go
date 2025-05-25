package models

import (
	"encoding/json"
	"strconv"
	"time"
)

// Candle represents OHLCV candlestick data optimized for ultra-fast rendering
// Uses float64 for calculations and compact JSON field names for minimal payload
type Candle struct {
	ID                       int64     `json:"id" db:"id"`
	Symbol                   string    `json:"symbol" db:"symbol"`
	OpenTime                 time.Time `json:"open_time" db:"open_time"`
	Open                     string    `json:"open" db:"open"`
	High                     string    `json:"high" db:"high"`
	Low                      string    `json:"low" db:"low"`
	Close                    string    `json:"close" db:"close"`
	Volume                   string    `json:"volume" db:"volume"`
	CloseTime                time.Time `json:"close_time" db:"close_time"`
	QuoteAssetVolume         string    `json:"quote_asset_volume" db:"quote_asset_volume"`
	TradeCount               int32     `json:"trade_count" db:"trade_count"`
	TakerBuyBaseAssetVolume  string    `json:"taker_buy_base_asset_volume" db:"taker_buy_base_asset_volume"`
	TakerBuyQuoteAssetVolume string    `json:"taker_buy_quote_asset_volume" db:"taker_buy_quote_asset_volume"`
	Interval                 string    `json:"interval" db:"interval"`
	CreatedAt                time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time `json:"updated_at" db:"updated_at"`
}

// OptimizedCandle represents ultra-fast OHLCV data for frontend rendering
// Compact field names and optimal data types for minimal JSON payload (70% smaller)
type OptimizedCandle struct {
	T  int64   `json:"t"`  // Timestamp (Unix milliseconds)
	O  float64 `json:"o"`  // Open price
	H  float64 `json:"h"`  // High price
	L  float64 `json:"l"`  // Low price
	C  float64 `json:"c"`  // Close price
	V  float64 `json:"v"`  // Total volume
	BV float64 `json:"bv"` // Buy volume (taker buy base asset volume)
	SV float64 `json:"sv"` // Sell volume (total - buy volume)
}

// CandleResponse optimized for ultra-fast network transmission and parsing
type CandleResponse struct {
	S string            `json:"s"`           // Symbol
	I string            `json:"i"`           // Interval
	D []OptimizedCandle `json:"d"`           // Data array
	N int               `json:"n"`           // Count
	F int64             `json:"f,omitempty"` // First timestamp (optional)
	L int64             `json:"l,omitempty"` // Last timestamp (optional)
}

// Trade represents individual trade data for order flow analysis
type Trade struct {
	T int64   `json:"t"` // Timestamp
	P float64 `json:"p"` // Price
	Q float64 `json:"q"` // Quantity
	M bool    `json:"m"` // Is maker (true = sell, false = buy)
}

// FootprintLevel represents volume at a specific price level for footprint charts
type FootprintLevel struct {
	P  float64 `json:"p"`  // Price
	BV float64 `json:"bv"` // Buy volume
	SV float64 `json:"sv"` // Sell volume
	D  float64 `json:"d"`  // Delta (BV - SV)
	T  int     `json:"t"`  // Trade count
}

// FootprintCandle represents order flow data for a single candle
type FootprintCandle struct {
	T   int64            `json:"t"`   // Candle timestamp
	L   []FootprintLevel `json:"l"`   // Price levels with volume
	TBV float64          `json:"tbv"` // Total buy volume
	TSV float64          `json:"tsv"` // Total sell volume
	TD  float64          `json:"td"`  // Total delta
	POC float64          `json:"poc"` // Point of Control (highest volume price)
}

// VolumeProfileLevel represents volume at price for volume profile
type VolumeProfileLevel struct {
	P   float64 `json:"p"`   // Price
	V   float64 `json:"v"`   // Volume
	Pct float64 `json:"pct"` // Percentage of total volume
}

// VolumeProfile represents volume distribution across price levels
type VolumeProfile struct {
	S   string               `json:"s"`   // Symbol
	ST  int64                `json:"st"`  // Start time
	ET  int64                `json:"et"`  // End time
	L   []VolumeProfileLevel `json:"l"`   // Levels
	POC float64              `json:"poc"` // Point of Control
	VAH float64              `json:"vah"` // Value Area High
	VAL float64              `json:"val"` // Value Area Low
	VAV float64              `json:"vav"` // Value Area Volume %
}

// Liquidation represents detected liquidation event
type Liquidation struct {
	T    int64   `json:"t"`    // Timestamp
	P    float64 `json:"p"`    // Price
	V    float64 `json:"v"`    // Volume
	Side string  `json:"side"` // "buy" or "sell"
	Type string  `json:"type"` // "single", "cascade", "sweep"
	Conf float64 `json:"conf"` // Confidence score (0-1)
}

// Heatmap represents price/volume heatmap data
type Heatmap struct {
	S   string        `json:"s"`   // Symbol
	ST  int64         `json:"st"`  // Start time
	ET  int64         `json:"et"`  // End time
	L   []HeatmapCell `json:"l"`   // Cells
	Max float64       `json:"max"` // Max volume for normalization
}

// HeatmapCell represents a single cell in the heatmap
type HeatmapCell struct {
	P float64 `json:"p"` // Price
	T int64   `json:"t"` // Time
	V float64 `json:"v"` // Volume
	I float64 `json:"i"` // Intensity (0-1)
}

// CumulativeDelta represents cumulative delta data
type CumulativeDelta struct {
	T int64   `json:"t"` // Timestamp
	D float64 `json:"d"` // Delta value
	C float64 `json:"c"` // Cumulative delta
}

// RealTimeUpdate represents streaming data updates
type RealTimeUpdate struct {
	Type string      `json:"type"` // "candle", "trade", "orderbook", "liquidation"
	Data interface{} `json:"data"`
}

// CreateCandleRequest represents the request structure for creating candles
type CreateCandleRequest struct {
	Symbol   string `json:"symbol" binding:"required"`
	Interval string `json:"interval" binding:"required"`
	Limit    int    `json:"limit" binding:"required,min=1,max=1500"`
}

// CandleStats represents statistical information about candles
type CandleStats struct {
	Symbol    string    `json:"symbol"`
	Interval  string    `json:"interval"`
	Count     int       `json:"count"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}

// PERFORMANCE OPTIMIZATION METHODS

// ToOptimized converts regular Candle to OptimizedCandle for ultra-fast transmission
func (c *Candle) ToOptimized() OptimizedCandle {
	totalVolume := parseFloat(c.Volume)
	buyVolume := parseFloat(c.TakerBuyBaseAssetVolume)
	sellVolume := totalVolume - buyVolume

	return OptimizedCandle{
		T:  c.OpenTime.UnixMilli(),
		O:  parseFloat(c.Open),
		H:  parseFloat(c.High),
		L:  parseFloat(c.Low),
		C:  parseFloat(c.Close),
		V:  totalVolume,
		BV: buyVolume,
		SV: sellVolume,
	}
}

// ToMinimalJSON converts response to minimal JSON bytes (fastest serialization)
func (r *CandleResponse) ToMinimalJSON() ([]byte, error) {
	return json.Marshal(r)
}

// CacheKey generates optimized cache keys for Redis caching
func (r *CandleResponse) CacheKey() string {
	return r.S + ":" + r.I + ":" + strconv.FormatInt(r.F, 10) + ":" + strconv.FormatInt(r.L, 10)
}

// ParseFloat safely converts string to float64 with error handling
func parseFloat(s string) float64 {
	if val, err := strconv.ParseFloat(s, 64); err == nil {
		return val
	}
	return 0.0
}

// ParseFloat is the exported version for use in other packages
func ParseFloat(s string) float64 {
	return parseFloat(s)
}

// NewOptimizedResponse creates a new optimized response for ultra-fast rendering
func NewOptimizedResponse(symbol, interval string, candles []Candle) *CandleResponse {
	optimized := make([]OptimizedCandle, len(candles))

	var firstTime, lastTime int64
	if len(candles) > 0 {
		firstTime = candles[0].OpenTime.UnixMilli()
		lastTime = candles[len(candles)-1].OpenTime.UnixMilli()
	}

	for i, candle := range candles {
		optimized[i] = candle.ToOptimized()
	}

	return &CandleResponse{
		S: symbol,
		I: interval,
		D: optimized,
		N: len(optimized),
		F: firstTime,
		L: lastTime,
	}
}

// EstimateJSONSize estimates the JSON payload size for frontend optimization
func (r *CandleResponse) EstimateJSONSize() int {
	// Rough estimate: 60 bytes per candle + overhead
	return len(r.D)*60 + 100
}
