package controllers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
	"tterminal-backend/services"

	"github.com/labstack/echo/v4"
)

// AggregationController handles ultra-fast aggregated data endpoints
type AggregationController struct {
	aggregationService *services.AggregationService
}

// NewAggregationController creates a new aggregation controller
func NewAggregationController(aggregationService *services.AggregationService) *AggregationController {
	if aggregationService == nil {
		log.Fatalf("[AggregationController] CRITICAL: aggregationService cannot be nil")
	}
	log.Printf("[AggregationController] Successfully initialized")
	return &AggregationController{
		aggregationService: aggregationService,
	}
}

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message,omitempty"`
	Code    string            `json:"code,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}

// GetOptimizedCandles returns ultra-optimized candle data for frontend rendering
// GET /api/v1/aggregation/candles/:symbol/:interval?limit=500
func (ctrl *AggregationController) GetOptimizedCandles(c echo.Context) error {
	startTime := time.Now()

	// Extract parameters
	symbol := c.Param("symbol")
	interval := c.Param("interval")
	limitStr := c.QueryParam("limit")

	log.Printf("[AggregationController] GetOptimizedCandles request: symbol=%s, interval=%s, limit=%s", symbol, interval, limitStr)

	// Validate and parse parameters
	if symbol == "" {
		err := ErrorResponse{
			Error:   "Missing required parameter",
			Message: "Symbol parameter is required",
			Code:    "MISSING_SYMBOL",
			Details: map[string]string{"parameter": "symbol"},
		}
		log.Printf("[AggregationController] Validation error: %+v", err)
		return c.JSON(http.StatusBadRequest, err)
	}

	if interval == "" {
		err := ErrorResponse{
			Error:   "Missing required parameter",
			Message: "Interval parameter is required",
			Code:    "MISSING_INTERVAL",
			Details: map[string]string{"parameter": "interval"},
		}
		log.Printf("[AggregationController] Validation error: %+v", err)
		return c.JSON(http.StatusBadRequest, err)
	}

	// Parse limit with default
	limit := 500
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err != nil {
			errResp := ErrorResponse{
				Error:   "Invalid parameter format",
				Message: fmt.Sprintf("Limit must be a valid integer, got: %s", limitStr),
				Code:    "INVALID_LIMIT_FORMAT",
				Details: map[string]string{"parameter": "limit", "value": limitStr},
			}
			log.Printf("[AggregationController] Parse error: %+v", errResp)
			return c.JSON(http.StatusBadRequest, errResp)
		} else if parsedLimit <= 0 || parsedLimit > 5000 {
			errResp := ErrorResponse{
				Error:   "Invalid parameter value",
				Message: fmt.Sprintf("Limit must be between 1 and 5000, got: %d", parsedLimit),
				Code:    "INVALID_LIMIT_RANGE",
				Details: map[string]string{"parameter": "limit", "value": strconv.Itoa(parsedLimit), "min": "1", "max": "5000"},
			}
			log.Printf("[AggregationController] Validation error: %+v", errResp)
			return c.JSON(http.StatusBadRequest, errResp)
		} else {
			limit = parsedLimit
		}
	}

	log.Printf("[AggregationController] Calling aggregation service with validated parameters: symbol=%s, interval=%s, limit=%d", symbol, interval, limit)

	// Call aggregation service
	response, err := ctrl.aggregationService.GetAggregatedCandles(c.Request().Context(), symbol, interval, limit)
	if err != nil {
		duration := time.Since(startTime)
		errResp := ErrorResponse{
			Error:   "Service error",
			Message: fmt.Sprintf("Failed to get aggregated candles: %s", err.Error()),
			Code:    "AGGREGATION_SERVICE_ERROR",
			Details: map[string]string{
				"symbol":   symbol,
				"interval": interval,
				"limit":    strconv.Itoa(limit),
				"duration": duration.String(),
			},
		}
		log.Printf("[AggregationController] Service error after %v: %+v", duration, errResp)
		return c.JSON(http.StatusInternalServerError, errResp)
	}

	duration := time.Since(startTime)

	// Return with performance headers
	c.Response().Header().Set("Cache-Control", "public, max-age=30")
	c.Response().Header().Set("X-Data-Count", strconv.Itoa(response.N))
	c.Response().Header().Set("X-Response-Time", duration.String())
	c.Response().Header().Set("X-Cache-Key", fmt.Sprintf("agg:candles:%s:%s:%d", symbol, interval, limit))

	log.Printf("[AggregationController] Successfully returned %d candles in %v", response.N, duration)
	return c.JSON(http.StatusOK, response)
}

// GetServiceStats returns service statistics for debugging
// GET /api/v1/aggregation/stats
func (ctrl *AggregationController) GetServiceStats(c echo.Context) error {
	log.Printf("[AggregationController] GetServiceStats called")

	stats := ctrl.aggregationService.GetServiceStats()
	log.Printf("[AggregationController] Service stats: %+v", stats)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"service":   "aggregation",
		"stats":     stats,
		"timestamp": time.Now(),
	})
}

// GetVolumeProfile returns volume profile data for a symbol
// GET /api/v1/aggregation/volume-profile/:symbol?hours=24
func (ctrl *AggregationController) GetVolumeProfile(c echo.Context) error {
	startTime := time.Now()
	symbol := c.Param("symbol")
	hoursStr := c.QueryParam("hours")

	log.Printf("[AggregationController] GetVolumeProfile request: symbol=%s, hours=%s", symbol, hoursStr)

	// Validate symbol
	if symbol == "" {
		err := ErrorResponse{
			Error:   "Missing required parameter",
			Message: "Symbol parameter is required",
			Code:    "MISSING_SYMBOL",
		}
		log.Printf("[AggregationController] Validation error: %+v", err)
		return c.JSON(http.StatusBadRequest, err)
	}

	// Parse hours with default
	hours := 24
	if hoursStr != "" {
		if parsedHours, err := strconv.Atoi(hoursStr); err != nil {
			errResp := ErrorResponse{
				Error:   "Invalid parameter format",
				Message: fmt.Sprintf("Hours must be a valid integer, got: %s", hoursStr),
				Code:    "INVALID_HOURS_FORMAT",
			}
			log.Printf("[AggregationController] Parse error: %+v", errResp)
			return c.JSON(http.StatusBadRequest, errResp)
		} else if parsedHours <= 0 || parsedHours > 168 {
			errResp := ErrorResponse{
				Error:   "Invalid parameter value",
				Message: fmt.Sprintf("Hours must be between 1 and 168, got: %d", parsedHours),
				Code:    "INVALID_HOURS_RANGE",
			}
			log.Printf("[AggregationController] Validation error: %+v", errResp)
			return c.JSON(http.StatusBadRequest, errResp)
		} else {
			hours = parsedHours
		}
	}

	endTime := time.Now()
	startTimeRange := endTime.Add(-time.Duration(hours) * time.Hour)

	log.Printf("[AggregationController] Calling volume profile service: symbol=%s, timeRange=%v to %v", symbol, startTimeRange, endTime)

	volumeProfile, err := ctrl.aggregationService.GetVolumeProfile(c.Request().Context(), symbol, startTimeRange, endTime)
	if err != nil {
		duration := time.Since(startTime)
		errResp := ErrorResponse{
			Error:   "Service error",
			Message: fmt.Sprintf("Failed to get volume profile: %s", err.Error()),
			Code:    "VOLUME_PROFILE_ERROR",
			Details: map[string]string{
				"symbol":   symbol,
				"hours":    strconv.Itoa(hours),
				"duration": duration.String(),
			},
		}
		log.Printf("[AggregationController] Volume profile error after %v: %+v", duration, errResp)
		return c.JSON(http.StatusInternalServerError, errResp)
	}

	duration := time.Since(startTime)

	// Performance headers
	c.Response().Header().Set("Cache-Control", "public, max-age=120")
	c.Response().Header().Set("X-Levels-Count", strconv.Itoa(len(volumeProfile.L)))
	c.Response().Header().Set("X-Response-Time", duration.String())

	log.Printf("[AggregationController] Successfully returned volume profile with %d levels in %v", len(volumeProfile.L), duration)
	return c.JSON(http.StatusOK, volumeProfile)
}

// GetFootprintData returns footprint chart data
// GET /api/v1/aggregation/footprint/:symbol/:interval?limit=100
func (ctrl *AggregationController) GetFootprintData(c echo.Context) error {
	symbol := c.Param("symbol")
	interval := c.Param("interval")

	limit := 100
	if limitStr := c.QueryParam("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 1000 {
			limit = parsedLimit
		}
	}

	if symbol == "" || interval == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "symbol and interval are required",
		})
	}

	footprint, err := ctrl.aggregationService.GetFootprintData(c.Request().Context(), symbol, interval, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to get footprint data: " + err.Error(),
		})
	}

	// Performance headers
	c.Response().Header().Set("Cache-Control", "public, max-age=60")
	c.Response().Header().Set("X-Candles-Count", strconv.Itoa(len(footprint)))

	return c.JSON(http.StatusOK, map[string]interface{}{
		"symbol":   symbol,
		"interval": interval,
		"data":     footprint,
		"count":    len(footprint),
	})
}

// GetLiquidations returns detected liquidation events
// GET /api/v1/aggregation/liquidations/:symbol?hours=1
func (ctrl *AggregationController) GetLiquidations(c echo.Context) error {
	symbol := c.Param("symbol")

	hours := 1
	if hoursStr := c.QueryParam("hours"); hoursStr != "" {
		if parsedHours, err := strconv.Atoi(hoursStr); err == nil && parsedHours > 0 && parsedHours <= 24 {
			hours = parsedHours
		}
	}

	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "symbol is required",
		})
	}

	timeRange := time.Duration(hours) * time.Hour
	liquidations, err := ctrl.aggregationService.GetLiquidations(c.Request().Context(), symbol, timeRange)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to get liquidations: " + err.Error(),
		})
	}

	// Performance headers
	c.Response().Header().Set("Cache-Control", "public, max-age=30")
	c.Response().Header().Set("X-Events-Count", strconv.Itoa(len(liquidations)))

	return c.JSON(http.StatusOK, map[string]interface{}{
		"symbol":       symbol,
		"timeRange":    hours,
		"liquidations": liquidations,
		"count":        len(liquidations),
	})
}

// GetHeatmap returns price/volume heatmap data
// GET /api/v1/aggregation/heatmap/:symbol?hours=6&resolution=100
func (ctrl *AggregationController) GetHeatmap(c echo.Context) error {
	symbol := c.Param("symbol")

	hours := 6
	if hoursStr := c.QueryParam("hours"); hoursStr != "" {
		if parsedHours, err := strconv.Atoi(hoursStr); err == nil && parsedHours > 0 && parsedHours <= 48 {
			hours = parsedHours
		}
	}

	resolution := 100
	if resStr := c.QueryParam("resolution"); resStr != "" {
		if parsedRes, err := strconv.Atoi(resStr); err == nil && parsedRes >= 10 && parsedRes <= 500 {
			resolution = parsedRes
		}
	}

	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "symbol is required",
		})
	}

	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(hours) * time.Hour)

	heatmap, err := ctrl.aggregationService.GetHeatmap(c.Request().Context(), symbol, startTime, endTime, resolution)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to get heatmap: " + err.Error(),
		})
	}

	// Performance headers
	c.Response().Header().Set("Cache-Control", "public, max-age=300")
	c.Response().Header().Set("X-Cells-Count", strconv.Itoa(len(heatmap.L)))

	return c.JSON(http.StatusOK, heatmap)
}

// GetAggregatedMultiData returns multiple data types in one call for maximum efficiency
// POST /api/v1/aggregation/multi
func (ctrl *AggregationController) GetAggregatedMultiData(c echo.Context) error {
	type MultiRequest struct {
		Symbol     string   `json:"symbol"`
		Intervals  []string `json:"intervals"`
		Limit      int      `json:"limit"`
		IncludeVP  bool     `json:"include_volume_profile"`
		IncludeLiq bool     `json:"include_liquidations"`
		VPHours    int      `json:"vp_hours"`
		LiqHours   int      `json:"liq_hours"`
	}

	var req MultiRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request format",
		})
	}

	if req.Symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "symbol is required",
		})
	}

	if len(req.Intervals) == 0 {
		req.Intervals = []string{"1m", "5m", "15m", "1h"}
	}

	if req.Limit <= 0 || req.Limit > 1000 {
		req.Limit = 500
	}

	response := map[string]interface{}{
		"symbol":  req.Symbol,
		"candles": make(map[string]interface{}),
	}

	// Get candles for all intervals
	for _, interval := range req.Intervals {
		candles, err := ctrl.aggregationService.GetAggregatedCandles(c.Request().Context(), req.Symbol, interval, req.Limit)
		if err == nil {
			response["candles"].(map[string]interface{})[interval] = candles
		}
	}

	// Get volume profile if requested
	if req.IncludeVP {
		if req.VPHours <= 0 || req.VPHours > 168 {
			req.VPHours = 24
		}
		endTime := time.Now()
		startTime := endTime.Add(-time.Duration(req.VPHours) * time.Hour)

		vp, err := ctrl.aggregationService.GetVolumeProfile(c.Request().Context(), req.Symbol, startTime, endTime)
		if err == nil {
			response["volume_profile"] = vp
		}
	}

	// Get liquidations if requested
	if req.IncludeLiq {
		if req.LiqHours <= 0 || req.LiqHours > 24 {
			req.LiqHours = 1
		}
		timeRange := time.Duration(req.LiqHours) * time.Hour

		liquidations, err := ctrl.aggregationService.GetLiquidations(c.Request().Context(), req.Symbol, timeRange)
		if err == nil {
			response["liquidations"] = liquidations
		}
	}

	// Ultra-fast response headers
	c.Response().Header().Set("Cache-Control", "public, max-age=30")
	c.Response().Header().Set("X-Multi-Response", "true")

	return c.JSON(http.StatusOK, response)
}
