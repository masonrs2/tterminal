package controllers

import (
	"net/http"

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
	stats := map[string]interface{}{
		"connected_clients": wsc.hub.GetConnectedClients(),
		"subscriptions":     wsc.hub.GetSubscriptionStats(),
		"binance_symbols":   wsc.binanceStream.GetConnectedSymbols(),
		"service":           "websocket",
		"status":            "active",
	}

	return c.JSON(http.StatusOK, stats)
}

// GetLastPrice returns the last known price for a symbol from WebSocket stream
func (wsc *WebSocketController) GetLastPrice(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol parameter is required",
		})
	}

	price, exists := wsc.binanceStream.GetLastPrice(symbol)
	if !exists {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Price not available for symbol: " + symbol,
		})
	}

	response := map[string]interface{}{
		"symbol": symbol,
		"price":  price,
		"source": "websocket",
	}

	return c.JSON(http.StatusOK, response)
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
