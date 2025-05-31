package controllers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"tterminal-backend/internal/websocket"

	"github.com/labstack/echo/v4"
)

// WebSocketController handles WebSocket-related endpoints
type WebSocketController struct {
	hub           *websocket.Hub
	binanceStream *websocket.BinanceStream
}

// NewWebSocketController creates a new WebSocket controller
func NewWebSocketController() *WebSocketController {
	// Create WebSocket hub
	hub := websocket.NewHub()

	// Start the hub in a goroutine
	go hub.Run()

	// Create Binance stream with popular symbols
	symbols := []string{"BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT"}
	binanceStream := websocket.NewBinanceStream(hub, symbols)

	// Start Binance stream
	if err := binanceStream.Start(); err != nil {
		// Log error but don't crash - fallback to HTTP polling
		echo.New().Logger.Errorf("Failed to start Binance stream: %v", err)
	}

	return &WebSocketController{
		hub:           hub,
		binanceStream: binanceStream,
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func (wsc *WebSocketController) HandleWebSocket(c echo.Context) error {
	wsc.hub.HandleWebSocket(c.Response(), c.Request())
	return nil
}

// GetWebSocketStats returns WebSocket connection statistics
func (wsc *WebSocketController) GetWebSocketStats(c echo.Context) error {
	// Get enhanced stream statistics
	streamStats := wsc.binanceStream.GetStreamStats()

	stats := map[string]interface{}{
		"connected_clients": wsc.hub.GetConnectedClients(),
		"subscriptions":     wsc.hub.GetSubscriptionStats(),
		"binance_stream":    streamStats,
		"service":           "websocket",
		"status":            "active",
		"data_types": []string{
			"price_updates",       // Real-time price changes (Spot + Futures)
			"depth_updates",       // Order book depth
			"trade_updates",       // Individual trades
			"kline_updates",       // Real-time candles
			"mark_price_updates",  // Futures mark prices
			"liquidation_updates", // Futures liquidations
		},
		"endpoints": map[string]string{
			"websocket":    "/api/v1/websocket/connect",
			"price":        "/api/v1/websocket/price/{symbol}",
			"depth":        "/api/v1/websocket/depth/{symbol}",
			"trades":       "/api/v1/websocket/trades/{symbol}",
			"klines":       "/api/v1/websocket/kline/{symbol}/{interval}",
			"mark_price":   "/api/v1/websocket/markprice/{symbol}",
			"liquidations": "/api/v1/websocket/liquidations/{symbol}",
		},
	}

	return c.JSON(200, stats)
}

// GetLastPrice returns the last known price for a symbol
func (wsc *WebSocketController) GetLastPrice(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}

	price, exists := wsc.binanceStream.GetLastPrice(symbol)
	if !exists {
		return c.JSON(404, map[string]string{"error": "Price data not found for symbol"})
	}

	response := map[string]interface{}{
		"symbol":    symbol,
		"price":     price,
		"timestamp": time.Now().UnixMilli(),
		"source":    "websocket_cache",
	}

	return c.JSON(200, response)
}

// GetDepthData returns the latest order book depth data for a symbol
func (wsc *WebSocketController) GetDepthData(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}

	depth, exists := wsc.binanceStream.GetDepthData(symbol)
	if !exists {
		return c.JSON(404, map[string]string{"error": "Depth data not found for symbol"})
	}

	response := map[string]interface{}{
		"symbol":          symbol,
		"bids":            depth.Bids,
		"asks":            depth.Asks,
		"first_update_id": depth.FirstUpdateID,
		"final_update_id": depth.FinalUpdateID,
		"event_time":      depth.EventTime,
		"timestamp":       time.Now().UnixMilli(),
		"source":          "websocket_cache",
	}

	return c.JSON(200, response)
}

// GetRecentTrades returns recent trades for a symbol
func (wsc *WebSocketController) GetRecentTrades(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}

	// Parse limit parameter
	limitStr := c.QueryParam("limit")
	limit := 100 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	trades := wsc.binanceStream.GetRecentTrades(symbol, limit)
	if trades == nil {
		return c.JSON(404, map[string]string{"error": "Trade data not found for symbol"})
	}

	response := map[string]interface{}{
		"symbol":    symbol,
		"trades":    trades,
		"count":     len(trades),
		"limit":     limit,
		"timestamp": time.Now().UnixMilli(),
		"source":    "websocket_cache",
	}

	return c.JSON(200, response)
}

// GetVolumeData returns real-time buy/sell volume data for a symbol
func (wsc *WebSocketController) GetVolumeData(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}

	// Get interval parameter (default to 1m if not provided for backward compatibility)
	interval := c.QueryParam("interval")
	if interval == "" {
		interval = "1m"
	}

	// Get current kline data for the specified interval
	klineData, exists := wsc.binanceStream.GetKlineData(symbol, interval)
	if !exists {
		return c.JSON(404, map[string]string{"error": "Volume data not found for symbol and interval"})
	}

	// Parse volume data from kline
	totalVolume, _ := strconv.ParseFloat(klineData.Kline.Volume, 64)
	takerBuyVolume, _ := strconv.ParseFloat(klineData.Kline.TakerBuyBaseVolume, 64)

	// Calculate buy/sell volumes
	buyVolume := takerBuyVolume
	sellVolume := totalVolume - takerBuyVolume
	delta := buyVolume - sellVolume

	// Calculate percentages
	buyPercentage := 0.0
	sellPercentage := 0.0
	if totalVolume > 0 {
		buyPercentage = (buyVolume / totalVolume) * 100
		sellPercentage = (sellVolume / totalVolume) * 100
	}

	// Get recent trades for additional context
	recentTrades := wsc.binanceStream.GetRecentTrades(symbol, 10)

	// Convert trades to simplified format
	simplifiedTrades := make([]map[string]interface{}, 0, len(recentTrades))
	for _, trade := range recentTrades {
		price, _ := strconv.ParseFloat(trade.Price, 64)
		quantity, _ := strconv.ParseFloat(trade.Quantity, 64)

		simplifiedTrades = append(simplifiedTrades, map[string]interface{}{
			"price":     price,
			"quantity":  quantity,
			"is_buy":    !trade.IsBuyerMaker, // Inverted: if buyer is maker, it's a sell order
			"timestamp": trade.TradeTime,
		})
	}

	response := map[string]interface{}{
		"symbol": symbol,
		"current_candle": map[string]interface{}{
			"interval":        interval, // Use dynamic interval instead of hardcoded "1m"
			"total_volume":    totalVolume,
			"buy_volume":      buyVolume,
			"sell_volume":     sellVolume,
			"delta":           delta,
			"buy_percentage":  buyPercentage,
			"sell_percentage": sellPercentage,
			"start_time":      klineData.Kline.StartTime,
			"is_closed":       klineData.Kline.IsClosed,
		},
		"recent_trades": simplifiedTrades,
		"timestamp":     time.Now().UnixMilli(),
		"source":        "websocket_cache",
	}

	return c.JSON(200, response)
}

// GetKlineData returns the latest kline data for a symbol and interval
func (wsc *WebSocketController) GetKlineData(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	interval := c.Param("interval")

	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}
	if interval == "" {
		return c.JSON(400, map[string]string{"error": "Interval parameter is required"})
	}

	kline, exists := wsc.binanceStream.GetKlineData(symbol, interval)
	if !exists {
		return c.JSON(404, map[string]string{"error": "Kline data not found for symbol and interval"})
	}

	response := map[string]interface{}{
		"symbol":     symbol,
		"interval":   interval,
		"kline":      kline.Kline,
		"event_time": kline.EventTime,
		"timestamp":  time.Now().UnixMilli(),
		"source":     "websocket_cache",
	}

	return c.JSON(200, response)
}

// GetMarkPriceData returns the latest Futures mark price data for a symbol
func (wsc *WebSocketController) GetMarkPriceData(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}

	markPrice, exists := wsc.binanceStream.GetMarkPriceData(symbol)
	if !exists {
		return c.JSON(404, map[string]string{"error": "Mark price data not found for symbol"})
	}

	response := map[string]interface{}{
		"symbol":            symbol,
		"mark_price":        markPrice.MarkPrice,
		"index_price":       markPrice.IndexPrice,
		"estimated_price":   markPrice.EstimatedPrice,
		"funding_rate":      markPrice.FundingRate,
		"next_funding_time": markPrice.NextFundingTime,
		"event_time":        markPrice.EventTime,
		"timestamp":         time.Now().UnixMilli(),
		"source":            "websocket_cache",
	}

	return c.JSON(200, response)
}

// GetRecentLiquidations returns recent Futures liquidations for a symbol
func (wsc *WebSocketController) GetRecentLiquidations(c echo.Context) error {
	symbol := strings.ToUpper(c.Param("symbol"))
	if symbol == "" {
		return c.JSON(400, map[string]string{"error": "Symbol parameter is required"})
	}

	// Parse limit parameter
	limitStr := c.QueryParam("limit")
	limit := 100 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	liquidations := wsc.binanceStream.GetRecentLiquidations(symbol, limit)

	// Return empty array instead of error when no liquidations exist
	if liquidations == nil {
		liquidations = []*websocket.BinanceLiquidationData{}
	}

	response := map[string]interface{}{
		"symbol":       symbol,
		"liquidations": liquidations,
		"count":        len(liquidations),
		"limit":        limit,
		"timestamp":    time.Now().UnixMilli(),
		"source":       "websocket_cache",
	}

	return c.JSON(200, response)
}

// AddSymbolToStream adds a new symbol to the Binance stream
func (wsc *WebSocketController) AddSymbolToStream(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol parameter is required",
		})
	}

	wsc.binanceStream.AddSymbol(symbol)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Symbol added to stream",
		"symbol":  symbol,
		"symbols": wsc.binanceStream.GetConnectedSymbols(),
	})
}

// GetHub returns the WebSocket hub (for use in other parts of the application)
func (wsc *WebSocketController) GetHub() *websocket.Hub {
	return wsc.hub
}

// GetBinanceStream returns the Binance stream (for use in other parts of the application)
func (wsc *WebSocketController) GetBinanceStream() *websocket.BinanceStream {
	return wsc.binanceStream
}
