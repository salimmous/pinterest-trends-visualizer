
// Helper to convert date strings to timestamps safely
export const parseDateToTimestamp = (dateStr: string): number | null => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null;
  }
  // Normalize to UTC midnight to avoid timezone issues affecting date grouping
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const CHART_LINE_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F',
  '#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#FFBB28'
];

export const MA_LINE_COLOR = '#777777'; // Dark gray for Moving Average line

export const GOOD_MONTH_THRESHOLD = 75; 

export const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const ITEMS_PER_PAGE = 20;

// --- Settings Defaults ---
export const DEFAULT_ANALYSIS_WINDOW_MONTHS = 24;
export const DEFAULT_MA_WINDOW_POINTS = 3;
export const DEFAULT_SEASONAL_PEAK_THRESHOLD_PCT = 25; // e.g., 25 means 125% of average
export const DEFAULT_VOLATILITY_CV_THRESHOLD_PCT = 35; // CV %
export const DEFAULT_PINTEREST_API_KEY = "YOUR_PINTEREST_API_KEY_PLACEHOLDER";
export const DEFAULT_GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_PLACEHOLDER";
