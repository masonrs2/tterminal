package controllers

import (
	"net/http"
	"tterminal-backend/models"
	"tterminal-backend/services"

	"github.com/labstack/echo/v4"
)

// SymbolController handles symbol-related HTTP requests
type SymbolController struct {
	symbolService *services.SymbolService
}

// NewSymbolController creates a new symbol controller
func NewSymbolController(symbolService *services.SymbolService) *SymbolController {
	return &SymbolController{
		symbolService: symbolService,
	}
}

// GetSymbols retrieves all symbols
func (sc *SymbolController) GetSymbols(c echo.Context) error {
	ctx := c.Request().Context()

	// Check if only active symbols are requested
	activeOnly := c.QueryParam("active") == "true"

	var symbols []models.Symbol
	var err error

	if activeOnly {
		symbols, err = sc.symbolService.GetActiveSymbols(ctx)
	} else {
		symbols, err = sc.symbolService.GetAllSymbols(ctx)
	}

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to retrieve symbols: " + err.Error(),
		})
	}

	response := models.SymbolResponse{
		Count:   len(symbols),
		Symbols: symbols,
	}

	return c.JSON(http.StatusOK, response)
}

// GetSymbol retrieves a specific symbol
func (sc *SymbolController) GetSymbol(c echo.Context) error {
	ctx := c.Request().Context()
	symbolName := c.Param("symbol")

	if symbolName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol parameter is required",
		})
	}

	symbol, err := sc.symbolService.GetSymbol(ctx, symbolName)
	if err != nil {
		if err.Error() == "symbol not found" {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Symbol not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to retrieve symbol: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, symbol)
}

// CreateSymbol creates a new symbol
func (sc *SymbolController) CreateSymbol(c echo.Context) error {
	ctx := c.Request().Context()

	var req models.CreateSymbolRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
	}

	symbol, err := sc.symbolService.CreateSymbol(ctx, &req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Failed to create symbol: " + err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, symbol)
}

// UpdateSymbol updates an existing symbol
func (sc *SymbolController) UpdateSymbol(c echo.Context) error {
	ctx := c.Request().Context()
	symbolName := c.Param("symbol")

	if symbolName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol parameter is required",
		})
	}

	var req models.UpdateSymbolRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
	}

	err := sc.symbolService.UpdateSymbol(ctx, symbolName, &req)
	if err != nil {
		if err.Error() == "symbol not found" {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Symbol not found",
			})
		}
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Failed to update symbol: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Symbol updated successfully",
	})
}

// DeleteSymbol deletes a symbol
func (sc *SymbolController) DeleteSymbol(c echo.Context) error {
	ctx := c.Request().Context()
	symbolName := c.Param("symbol")

	if symbolName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Symbol parameter is required",
		})
	}

	err := sc.symbolService.DeleteSymbol(ctx, symbolName)
	if err != nil {
		if err.Error() == "symbol not found" {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Symbol not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete symbol: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Symbol deleted successfully",
	})
}
