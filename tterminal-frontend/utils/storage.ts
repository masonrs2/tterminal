/**
 * localStorage utility functions for persisting trading terminal state
 * Handles serialization, error handling, and type safety
 */

const STORAGE_KEYS = {
  TRADING_STATE: 'tterminal_trading_state',
  INDICATOR_SETTINGS: 'tterminal_indicator_settings',
  VIEWPORT_STATE: 'tterminal_viewport_state',
  COMPONENT_SIZES: 'tterminal_component_sizes',
  UI_STATE: 'tterminal_ui_state',
  THEME_STATE: 'tterminal_theme_state',
  DRAWING_TOOLS: 'tterminal_drawing_tools',
} as const

/**
 * Safely get data from localStorage with error handling
 */
export const getStoredData = <T>(key: string, defaultValue: T): T => {
  try {
    if (typeof window === 'undefined') return defaultValue
    
    const stored = localStorage.getItem(key)
    if (!stored) return defaultValue
    
    return JSON.parse(stored) as T
  } catch (error) {
    console.warn(`Failed to load data from localStorage for key: ${key}`, error)
    return defaultValue
  }
}

/**
 * Safely set data to localStorage with error handling
 */
export const setStoredData = <T>(key: string, data: T): void => {
  try {
    if (typeof window === 'undefined') return
    
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn(`Failed to save data to localStorage for key: ${key}`, error)
  }
}

/**
 * Remove data from localStorage
 */
export const removeStoredData = (key: string): void => {
  try {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`Failed to remove data from localStorage for key: ${key}`, error)
  }
}

/**
 * Clear all trading terminal data from localStorage
 */
export const clearAllStoredData = (): void => {
  Object.values(STORAGE_KEYS).forEach(key => {
    removeStoredData(key)
  })
}

export { STORAGE_KEYS } 