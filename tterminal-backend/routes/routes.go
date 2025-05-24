package routes

import (
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

	// Initialize controllers
	candleController := controllers.NewCandleController(candleService, binanceService)
	symbolController := controllers.NewSymbolController(symbolService)
	healthController := controllers.NewHealthController(db)
	aggregationController := controllers.NewAggregationController(aggregationService)

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

	// WebSocket routes for real-time data
	ws := v1.Group("/ws")
	ws.GET("/candles/:symbol", candleController.StreamCandles)
}
