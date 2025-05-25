package routes

import (
	"fmt"
	"tterminal-backend/config"
	"tterminal-backend/controllers"
	"tterminal-backend/internal/binance"
	"tterminal-backend/internal/database"
	"tterminal-backend/internal/middleware"
	"tterminal-backend/pkg/cache"
	"tterminal-backend/repositories"
	"tterminal-backend/services"

	"github.com/labstack/echo/v4"
)

// SetupRoutes configures all application routes with ultra-fast aggregation endpoints
func SetupRoutes(e *echo.Echo, db *database.DB, cfg *config.Config) {
	// Initialize Redis cache for ultra-fast performance
	redisCache := cache.NewRedisCache("localhost:6379", "", 0)

	// Initialize Binance client
	binanceClient := binance.NewClient(cfg)

	// Initialize repositories
	candleRepo := repositories.NewCandleRepository(db)
	symbolRepo := repositories.NewSymbolRepository(db)

	// Initialize services with Binance client for ultra-fast data fetching
	candleService := services.NewCandleService(candleRepo, binanceClient)
	symbolService := services.NewSymbolService(symbolRepo)
	binanceService := services.NewBinanceService(cfg)

	// Initialize ultra-fast aggregation service
	aggregationService := services.NewAggregationService(candleService, redisCache)

	// Initialize DATA COLLECTION SERVICE for continuous fresh data
	dataCollectionService := services.NewDataCollectionService(candleRepo, binanceClient)

	// Start the data collection service to ensure fresh data
	if err := dataCollectionService.Start(); err != nil {
		panic(fmt.Sprintf("Failed to start data collection service: %v", err))
	}

	// Initialize controllers
	candleController := controllers.NewCandleController(candleService, binanceService)
	symbolController := controllers.NewSymbolController(symbolService)
	healthController := controllers.NewHealthController(db)
	aggregationController := controllers.NewAggregationController(aggregationService)
	dataCollectionController := controllers.NewDataCollectionController(dataCollectionService)

	// Initialize ULTRA-FAST WebSocket controller for real-time streaming
	websocketController := controllers.NewWebSocketController()

	// Setup middleware
	e.Use(middleware.CORS(cfg))
	e.Use(middleware.RateLimit(cfg))

	// API v1 routes
	v1 := e.Group("/api/v1")

	// Health check
	v1.GET("/health", healthController.HealthCheck)

	// Symbol routes
	symbols := v1.Group("/symbols")
	symbols.GET("", symbolController.GetSymbols)
	symbols.GET("/:symbol", symbolController.GetSymbol)
	symbols.POST("", symbolController.CreateSymbol)
	symbols.PUT("/:symbol", symbolController.UpdateSymbol)
	symbols.DELETE("/:symbol", symbolController.DeleteSymbol)

	// Ultra-fast candle routes optimized for rendering performance
	candles := v1.Group("/candles")
	candles.GET("/:symbol", candleController.GetCandles)               // Optimized response format
	candles.GET("/:symbol/raw", candleController.GetCandlesRaw)        // Pre-serialized JSON for maximum speed
	candles.GET("/:symbol/metrics", candleController.GetCandleMetrics) // Performance monitoring
	candles.POST("/fetch", candleController.FetchAndStoreCandles)      // Fetch from Binance
	candles.GET("/:symbol/latest", candleController.GetLatestCandle)   // Latest candle
	candles.GET("/:symbol/range", candleController.GetCandleRange)     // Time range queries

	// ULTRA-FAST AGGREGATION ROUTES - THE FASTEST DATA ENDPOINTS
	agg := v1.Group("/aggregation")

	// Service monitoring and debugging
	agg.GET("/stats", aggregationController.GetServiceStats)

	// Optimized candle data (70% smaller payload, <50ms response)
	agg.GET("/candles/:symbol/:interval", aggregationController.GetOptimizedCandles)

	// Advanced trading data (volume profile, footprints, liquidations, heatmaps)
	agg.GET("/volume-profile/:symbol", aggregationController.GetVolumeProfile)
	agg.GET("/footprint/:symbol/:interval", aggregationController.GetFootprintData)
	agg.GET("/liquidations/:symbol", aggregationController.GetLiquidations)
	agg.GET("/heatmap/:symbol", aggregationController.GetHeatmap)

	// Multi-data endpoint for frontend efficiency (get everything in one call)
	agg.POST("/multi", aggregationController.GetAggregatedMultiData)

	// DATA COLLECTION SERVICE ROUTES - For monitoring and controlling continuous data collection
	collection := v1.Group("/data-collection")
	collection.GET("/stats", dataCollectionController.GetStats)                  // Service statistics
	collection.POST("/collect", dataCollectionController.TriggerCollection)      // Manual trigger
	collection.POST("/historical", dataCollectionController.FetchHistoricalData) // Fetch historical data
	collection.POST("/start", dataCollectionController.StartService)             // Start service
	collection.POST("/stop", dataCollectionController.StopService)               // Stop service
	collection.POST("/symbols", dataCollectionController.AddSymbol)              // Add symbol to collection
	collection.DELETE("/symbols/:symbol", dataCollectionController.RemoveSymbol) // Remove symbol

	// ULTRA-FAST WEBSOCKET ROUTES - SUB-100MS REAL-TIME UPDATES
	ws := v1.Group("/websocket")

	// WebSocket connection endpoint - upgrade HTTP to WebSocket
	ws.GET("/connect", websocketController.HandleWebSocket)

	// WebSocket service statistics and monitoring
	ws.GET("/stats", websocketController.GetWebSocketStats)

	// Real-time price endpoints (fallback for when WebSocket isn't available)
	ws.GET("/price/:symbol", websocketController.GetLastPrice)

	// Enhanced Binance WebSocket data endpoints - maximizing data streams
	ws.GET("/depth/:symbol", websocketController.GetDepthData)           // Order book depth
	ws.GET("/trades/:symbol", websocketController.GetRecentTrades)       // Recent trades
	ws.GET("/kline/:symbol/:interval", websocketController.GetKlineData) // Kline data

	// NEW: Futures-specific endpoints for derivatives trading
	ws.GET("/markprice/:symbol", websocketController.GetMarkPriceData)         // Futures mark price
	ws.GET("/liquidations/:symbol", websocketController.GetRecentLiquidations) // Futures liquidations

	// Symbol management endpoints
	ws.POST("/symbols/:symbol", websocketController.AddSymbolToStream) // Add symbol to stream

	// Legacy WebSocket routes for backward compatibility
	legacyWs := v1.Group("/ws")
	legacyWs.GET("/candles/:symbol", candleController.StreamCandles)
}
