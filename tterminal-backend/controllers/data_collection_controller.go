package controllers

import (
	"log"
	"net/http"
	"tterminal-backend/services"

	"github.com/labstack/echo/v4"
)

// DataCollectionController handles data collection service endpoints
type DataCollectionController struct {
	dataCollectionService *services.DataCollectionService
}

// NewDataCollectionController creates a new data collection controller
func NewDataCollectionController(dataCollectionService *services.DataCollectionService) *DataCollectionController {
	return &DataCollectionController{
		dataCollectionService: dataCollectionService,
	}
}

// GetStats returns current data collection statistics
// GET /api/v1/data-collection/stats
func (ctrl *DataCollectionController) GetStats(c echo.Context) error {
	stats := ctrl.dataCollectionService.GetStats()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"service": "data_collection",
		"stats":   stats,
	})
}

// TriggerCollection manually triggers a data collection run
// POST /api/v1/data-collection/collect
func (ctrl *DataCollectionController) TriggerCollection(c echo.Context) error {
	if !ctrl.dataCollectionService.IsRunning() {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error":   "service_not_running",
			"message": "Data collection service is not running",
		})
	}

	ctrl.dataCollectionService.CollectNow()

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Data collection triggered successfully",
	})
}

// StartService starts the data collection service
// POST /api/v1/data-collection/start
func (ctrl *DataCollectionController) StartService(c echo.Context) error {
	if ctrl.dataCollectionService.IsRunning() {
		return c.JSON(http.StatusConflict, map[string]string{
			"error":   "already_running",
			"message": "Data collection service is already running",
		})
	}

	if err := ctrl.dataCollectionService.Start(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error":   "start_failed",
			"message": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Data collection service started successfully",
	})
}

// StopService stops the data collection service
// POST /api/v1/data-collection/stop
func (ctrl *DataCollectionController) StopService(c echo.Context) error {
	if !ctrl.dataCollectionService.IsRunning() {
		return c.JSON(http.StatusConflict, map[string]string{
			"error":   "not_running",
			"message": "Data collection service is not running",
		})
	}

	ctrl.dataCollectionService.Stop()

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Data collection service stopped successfully",
	})
}

// AddSymbol adds a symbol to the collection list
// POST /api/v1/data-collection/symbols
func (ctrl *DataCollectionController) AddSymbol(c echo.Context) error {
	type AddSymbolRequest struct {
		Symbol string `json:"symbol" validate:"required"`
	}

	var req AddSymbolRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error":   "invalid_request",
			"message": "Invalid request format",
		})
	}

	if req.Symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error":   "missing_symbol",
			"message": "Symbol is required",
		})
	}

	ctrl.dataCollectionService.AddSymbol(req.Symbol)

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Symbol added successfully",
		"symbol":  req.Symbol,
	})
}

// RemoveSymbol removes a symbol from the collection list
// DELETE /api/v1/data-collection/symbols/:symbol
func (ctrl *DataCollectionController) RemoveSymbol(c echo.Context) error {
	symbol := c.Param("symbol")
	if symbol == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error":   "missing_symbol",
			"message": "Symbol parameter is required",
		})
	}

	ctrl.dataCollectionService.RemoveSymbol(symbol)

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Symbol removed successfully",
		"symbol":  symbol,
	})
}

// FetchHistoricalData manually triggers historical data fetching
func (ctrl *DataCollectionController) FetchHistoricalData(c echo.Context) error {
	if ctrl.dataCollectionService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Data collection service not available",
		})
	}

	// Check if service is running
	if !ctrl.dataCollectionService.IsRunning() {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Data collection service is not running",
		})
	}

	// Trigger historical data fetch in background
	go func() {
		log.Printf("[DataCollectionController] Manual historical data fetch triggered")
		// Use reflection to call the private method (or make it public)
		// For now, we'll trigger a full collection which includes historical data
		ctrl.dataCollectionService.CollectNow()
	}()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Historical data fetch triggered successfully",
		"status":  "running",
	})
}
