package controllers

import (
	"net/http"
	"strconv"
	"time"

	"tterminal-backend/services"

	"github.com/labstack/echo/v4"
)

type CandleController struct {
	candleService  *services.CandleService
	binanceService *services.BinanceService
}

func NewCandleController(candleService *services.CandleService, binanceService *services.BinanceService) *CandleController {
	return &CandleController{
		candleService:  candleService,
		binanceService: binanceService,
	}
}

// GetCandles retrieves candles optimized for ultra-fast frontend rendering
func (cc *CandleController) GetCandles(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol is required",
		})
	}

	// Parse query parameters
	limitStr := c.QueryParam("limit")
	limit := 100 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			if parsedLimit > 0 && parsedLimit <= 1500 {
				limit = parsedLimit
			}
		}
	}

	interval := c.QueryParam("interval")
	if interval == "" {
		interval = "1h" // default
	}

	// Use optimized method for ultra-fast response
	response, err := cc.candleService.GetOptimizedCandles(c.Request().Context(), symbol, interval, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	// Set optimized headers for caching and performance
	c.Response().Header().Set("Cache-Control", "public, max-age=30")
	c.Response().Header().Set("Content-Type", "application/json; charset=utf-8")
	
	return c.JSON(http.StatusOK, response)
}

// GetCandlesRaw returns pre-serialized JSON for maximum performance
func (cc *CandleController) GetCandlesRaw(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol is required",
		})
	}

	// Parse query parameters
	limitStr := c.QueryParam("limit")
	limit := 100 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			if parsedLimit > 0 && parsedLimit <= 1500 {
				limit = parsedLimit
			}
		}
	}

	interval := c.QueryParam("interval")
	if interval == "" {
		interval = "1h" // default
	}

	// Get pre-serialized JSON for maximum speed
	jsonBytes, err := cc.candleService.GetOptimizedCandlesJSON(c.Request().Context(), symbol, interval, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	// Set optimized headers
	c.Response().Header().Set("Cache-Control", "public, max-age=30")
	c.Response().Header().Set("Content-Type", "application/json; charset=utf-8")
	c.Response().Header().Set("Content-Length", strconv.Itoa(len(jsonBytes)))
	
	// Return raw JSON bytes for fastest possible response
	return c.Blob(http.StatusOK, "application/json", jsonBytes)
}

// FetchAndStoreCandles fetches candles from Binance and stores them
func (cc *CandleController) FetchAndStoreCandles(c echo.Context) error {
	var request struct {
		Symbol   string `json:"symbol" validate:"required"`
		Interval string `json:"interval" validate:"required"`
		Limit    int    `json:"limit"`
	}

	if err := c.Bind(&request); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if request.Limit == 0 {
		request.Limit = 100
	}

	// Use the optimized method which automatically fetches from Binance if needed
	response, err := cc.candleService.GetOptimizedCandles(c.Request().Context(), request.Symbol, request.Interval, request.Limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":    "Data fetched and cached successfully",
		"symbol":     request.Symbol,
		"interval":   request.Interval,
		"limit":      request.Limit,
		"count":      response.N,
		"first_time": response.F,
		"last_time":  response.L,
	})
}

// GetLatestCandle retrieves the latest candle for a symbol
func (cc *CandleController) GetLatestCandle(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol is required",
		})
	}

	interval := c.QueryParam("interval")
	if interval == "" {
		interval = "1h"
	}

	// Get optimized response with limit 1 for latest candle
	response, err := cc.candleService.GetOptimizedCandles(c.Request().Context(), symbol, interval, 1)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	var latestCandle interface{}
	if len(response.D) > 0 {
		latestCandle = response.D[0]
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"symbol":   symbol,
		"interval": interval,
		"candle":   latestCandle,
	})
}

// GetCandleRange retrieves candles within a time range
func (cc *CandleController) GetCandleRange(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol is required",
		})
	}

	// Parse time range parameters
	startTimeStr := c.QueryParam("start_time")
	endTimeStr := c.QueryParam("end_time")
	interval := c.QueryParam("interval")

	if interval == "" {
		interval = "1h"
	}

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Invalid start_time format, use RFC3339",
			})
		}
	}

	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Invalid end_time format, use RFC3339",
			})
		}
	}

	candles, err := cc.candleService.GetCandleRange(c.Request().Context(), symbol, interval, startTime, endTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"symbol":     symbol,
		"interval":   interval,
		"start_time": startTime,
		"end_time":   endTime,
		"candles":    candles,
	})
}

// StreamCandles handles WebSocket connections for real-time candle data
func (cc *CandleController) StreamCandles(c echo.Context) error {
	// For now, return a placeholder response
	return c.JSON(http.StatusNotImplemented, map[string]string{
		"message": "WebSocket streaming will be implemented in future version",
		"symbol":  c.Param("symbol"),
	})
}

// GetCandleMetrics returns performance metrics for monitoring
func (cc *CandleController) GetCandleMetrics(c echo.Context) error {
	symbol := c.Param("symbol")
	interval := c.QueryParam("interval")
	if interval == "" {
		interval = "1h"
	}

	// Get a small sample to estimate performance
	start := time.Now()
	response, err := cc.candleService.GetOptimizedCandles(c.Request().Context(), symbol, interval, 100)
	duration := time.Since(start)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	estimatedSize := response.EstimateJSONSize()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"symbol":           symbol,
		"interval":         interval,
		"response_time_ms": duration.Milliseconds(),
		"candle_count":     response.N,
		"estimated_size":   estimatedSize,
		"cache_key":        response.CacheKey(),
		"first_timestamp":  response.F,
		"last_timestamp":   response.L,
	})
}
 