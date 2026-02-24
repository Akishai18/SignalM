"""
Configuration for market indices to analyze
Defines which ETFs represent different markets and sectors
"""

# Major Market Indices
MARKET_INDICES = {
    'SPY': {
        'name': 'S&P 500',
        'description': 'Large-cap US stocks',
        'category': 'US Equity',
        'color': '#0ea5e9',
    },
    'QQQ': {
        'name': 'NASDAQ-100',
        'description': 'Tech-heavy large-cap',
        'category': 'US Equity',
        'color': '#8b5cf6',
    },
    'DIA': {
        'name': 'Dow Jones',
        'description': '30 blue-chip stocks',
        'category': 'US Equity',
        'color': '#10b981',
    },
    'IWM': {
        'name': 'Russell 2000',
        'description': 'Small-cap US stocks',
        'category': 'US Equity',
        'color': '#f59e0b',
    },
    'EFA': {
        'name': 'MSCI EAFE',
        'description': 'Developed international',
        'category': 'International',
        'color': '#06b6d4',
    },
    'EEM': {
        'name': 'Emerging Markets',
        'description': 'Emerging market equities',
        'category': 'International',
        'color': '#ec4899',
    },
}

# Sector ETFs (SPDR Select Sectors)
SECTOR_INDICES = {
    'XLK': {
        'name': 'Technology',
        'description': 'Tech sector',
        'category': 'Sector',
        'color': '#6366f1',
    },
    'XLF': {
        'name': 'Financials',
        'description': 'Financial sector',
        'category': 'Sector',
        'color': '#14b8a6',
    },
    'XLV': {
        'name': 'Healthcare',
        'description': 'Healthcare sector',
        'category': 'Sector',
        'color': '#ef4444',
    },
    'XLE': {
        'name': 'Energy',
        'description': 'Energy sector',
        'category': 'Sector',
        'color': '#f97316',
    },
    'XLY': {
        'name': 'Consumer Discretionary',
        'description': 'Consumer cyclical',
        'category': 'Sector',
        'color': '#a855f7',
    },
    'XLP': {
        'name': 'Consumer Staples',
        'description': 'Consumer defensive',
        'category': 'Sector',
        'color': '#22c55e',
    },
}

# Combined all indices
ALL_INDICES = {**MARKET_INDICES, **SECTOR_INDICES}

# Priority indices for main dashboard
PRIORITY_INDICES = ['SPY', 'QQQ', 'DIA', 'IWM']

# Regime label mapping
REGIME_LABELS = {
    0: 'Calm',
    1: 'Crisis',
    2: 'Elevated Stress',
    3: 'Transition'
}

# Regime colors
REGIME_COLORS = {
    0: '#10b981',  # green
    1: '#ef4444',  # red
    2: '#f59e0b',  # orange
    3: '#8b5cf6',  # purple
}


def get_index_info(symbol: str) -> dict:
    """Get metadata for an index"""
    return ALL_INDICES.get(symbol, {
        'name': symbol,
        'description': 'Unknown index',
        'category': 'Other',
        'color': '#6b7280'
    })


def get_indices_by_category(category: str) -> dict:
    """Get all indices in a category"""
    return {
        symbol: info
        for symbol, info in ALL_INDICES.items()
        if info['category'] == category
    }


def get_all_symbols() -> list:
    """Get list of all index symbols"""
    return list(ALL_INDICES.keys())
