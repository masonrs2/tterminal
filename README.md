# TTerminal - Trading Terminal Monorepo

A comprehensive trading terminal application with both frontend and backend components.

## Repository Structure

```
tterminal/
├── tterminal-frontend/     # React/Next.js trading terminal UI
└── tterminal-backend/      # Backend API (coming soon)
```

## Components

### 🖥️ Frontend (`tterminal-frontend/`)

A high-performance trading terminal built with React and Next.js featuring:

- **Real-time Price Charts**: Candlestick charts with volume analysis
- **Drawing Tools**: Technical analysis tools (rays, rectangles, horizontal lines)
- **Advanced Indicators**: VPVR, CVD, Liquidations, Heatmaps
- **Interactive Features**: Zoom, pan, keyboard shortcuts
- **Modular Architecture**: Enterprise-level code organization
- **High-Performance Rendering**: Canvas-based charts for smooth interaction

**Tech Stack**: React, Next.js, TypeScript, Tailwind CSS, Canvas API

### 🚀 Backend (`tterminal-backend/`)

Backend API services (coming soon) will include:

- Real-time market data feeds
- Trading execution endpoints
- User authentication and management
- Portfolio and risk management
- Market analysis and indicators

**Tech Stack**: TBD (considering Node.js/Express, Python/FastAPI, or Go/Gin)

## Getting Started

### Frontend Development

```bash
cd tterminal-frontend
npm install
npm run dev
```

### Backend Development

Coming soon...

## Features

### Trading Terminal Frontend

✅ **Chart Features**:
- Real-time candlestick charts
- Volume profile (VPVR) with customizable settings
- Multiple timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
- Zoom and pan with mouse wheel
- Responsive design with resizable panels

✅ **Drawing Tools**:
- Horizontal Ray lines
- Rectangle selection
- Trend Ray lines
- Interactive movement and editing
- Right-click context menu for removal
- Double-click for settings panel

✅ **Indicators**:
- Volume Profile Visible Range (VPVR)
- Cumulative Volume Delta (CVD)
- Liquidations overlay
- Order flow heatmap
- Customizable indicator settings

✅ **User Experience**:
- Keyboard shortcuts (Delete, Escape, +/-, Ctrl+0)
- High-performance orderbook component
- Professional trading interface
- Dark theme optimized for trading

## Architecture

The frontend uses a modular architecture with:

- **State Management**: Custom hooks for centralized state
- **Component Architecture**: Separated UI components by function
- **Type Safety**: Full TypeScript implementation
- **Performance**: Optimized canvas rendering
- **Maintainability**: Clear separation of concerns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
