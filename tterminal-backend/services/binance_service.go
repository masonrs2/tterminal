package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"
	"tterminal-backend/config"
	"tterminal-backend/internal/binance"
	"tterminal-backend/models"
)

// BinanceService handles Binance API operations
type BinanceService struct {
	client *binance.Client
	cfg    *config.Config
}

// NewBinanceService creates a new Binance service
func NewBinanceService(cfg *config.Config) *BinanceService {
	return &BinanceService{
		client: binance.NewClient(cfg),
		cfg:    cfg,
	}
}

// FetchKlines fetches kline data from Binance
func (s *BinanceService) FetchKlines(ctx context.Context, symbol, interval string, limit int) ([]models.Candle, error) {
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if interval == "" {
		return nil, fmt.Errorf("interval is required")
	}

	// Validate interval
	if !s.isValidInterval(interval) {
		return nil, fmt.Errorf("invalid interval: %s", interval)
	}

	// Limit to reasonable values
	if limit <= 0 || limit > 1500 {
		limit = 100
	}

	candles, err := s.client.GetKlines(symbol, interval, limit, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch klines from Binance: %w", err)
	}

	return candles, nil
}

// FetchKlinesWithTimeRange fetches kline data within a specific time range
func (s *BinanceService) FetchKlinesWithTimeRange(ctx context.Context, symbol, interval string, startTime, endTime time.Time) ([]models.Candle, error) {
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if interval == "" {
		return nil, fmt.Errorf("interval is required")
	}
	if startTime.After(endTime) {
		return nil, fmt.Errorf("start time must be before end time")
	}

	// Validate interval
	if !s.isValidInterval(interval) {
		return nil, fmt.Errorf("invalid interval: %s", interval)
	}

	candles, err := s.client.GetKlines(symbol, interval, 0, &startTime, &endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch klines from Binance: %w", err)
	}

	return candles, nil
}

// FetchExchangeInfo fetches exchange information from Binance
func (s *BinanceService) FetchExchangeInfo(ctx context.Context) (*binance.BinanceExchangeInfo, error) {
	exchangeInfo, err := s.client.GetExchangeInfo()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch exchange info from Binance: %w", err)
	}

	return exchangeInfo, nil
}

// ConvertBinanceSymbolToModel converts Binance symbol info to our model
func (s *BinanceService) ConvertBinanceSymbolToModel(binanceSymbol binance.BinanceSymbolInfo) *models.Symbol {
	symbol := &models.Symbol{
		Symbol:            binanceSymbol.Symbol,
		BaseAsset:         binanceSymbol.BaseAsset,
		QuoteAsset:        binanceSymbol.QuoteAsset,
		Status:            binanceSymbol.Status,
		IsActive:          binanceSymbol.Status == "TRADING",
		PricePrecision:    binanceSymbol.PricePrecision,
		QuantityPrecision: binanceSymbol.QuantityPrecision,
	}

	// Extract filter information
	for _, filter := range binanceSymbol.Filters {
		switch filter.FilterType {
		case "PRICE_FILTER":
			symbol.MinPrice = sql.NullString{String: filter.MinPrice, Valid: filter.MinPrice != ""}
			symbol.MaxPrice = sql.NullString{String: filter.MaxPrice, Valid: filter.MaxPrice != ""}
			symbol.TickSize = sql.NullString{String: filter.TickSize, Valid: filter.TickSize != ""}
		case "LOT_SIZE":
			symbol.MinQty = sql.NullString{String: filter.MinQty, Valid: filter.MinQty != ""}
			symbol.MaxQty = sql.NullString{String: filter.MaxQty, Valid: filter.MaxQty != ""}
			symbol.StepSize = sql.NullString{String: filter.StepSize, Valid: filter.StepSize != ""}
		}
	}

	return symbol
}

// isValidInterval checks if the interval is valid for Binance
func (s *BinanceService) isValidInterval(interval string) bool {
	validIntervals := map[string]bool{
		"1s":  true,
		"1m":  true,
		"3m":  true,
		"5m":  true,
		"15m": true,
		"30m": true,
		"1h":  true,
		"2h":  true,
		"4h":  true,
		"6h":  true,
		"8h":  true,
		"12h": true,
		"1d":  true,
		"3d":  true,
		"1w":  true,
		"1M":  true,
	}

	return validIntervals[interval]
}

// GetValidIntervals returns a list of valid intervals
func (s *BinanceService) GetValidIntervals() []string {
	return []string{
		"1s", "1m", "3m", "5m", "15m", "30m",
		"1h", "2h", "4h", "6h", "8h", "12h",
		"1d", "3d", "1w", "1M",
	}
}

// SyncSymbolsFromBinance fetches and returns symbols from Binance that can be synced to the database
func (s *BinanceService) SyncSymbolsFromBinance(ctx context.Context) ([]models.Symbol, error) {
	exchangeInfo, err := s.FetchExchangeInfo(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch exchange info: %w", err)
	}

	symbols := make([]models.Symbol, 0, len(exchangeInfo.Symbols))
	for _, binanceSymbol := range exchangeInfo.Symbols {
		// Only include USDT pairs for futures
		if binanceSymbol.QuoteAsset == "USDT" && binanceSymbol.Status == "TRADING" {
			symbol := s.ConvertBinanceSymbolToModel(binanceSymbol)
			symbols = append(symbols, *symbol)
		}
	}

	return symbols, nil
}
