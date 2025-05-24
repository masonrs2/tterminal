package models

import (
	"time"
)

// Candle represents OHLCV candlestick data from Binance
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

// CreateCandleRequest represents the request structure for creating candles
type CreateCandleRequest struct {
	Symbol   string `json:"symbol" binding:"required"`
	Interval string `json:"interval" binding:"required"`
	Limit    int    `json:"limit" binding:"required,min=1,max=1500"`
}

// CandleResponse represents the response structure for candle data
type CandleResponse struct {
	Symbol    string    `json:"symbol"`
	Interval  string    `json:"interval"`
	Count     int       `json:"count"`
	Candles   []Candle  `json:"candles"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}
