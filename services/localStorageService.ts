import { AggregatedData } from '../types';

const STORAGE_KEYS = {
  TREND_DATA: 'pinterest_trends_data',
  SETTINGS: 'pinterest_trends_settings',
  LAST_SAVE_DATE: 'pinterest_trends_last_save'
};

// Helper function to serialize AggregatedData for localStorage
const serializeAggregatedData = (data: AggregatedData): string => {
  const serializable: Record<string, any> = {};
  
  for (const keyword in data) {
    const item = data[keyword];
    serializable[keyword] = {
      keyword: item.keyword,
      pointsMap: Object.fromEntries(item.pointsMap), // Convert Map to object
      metadataEntries: item.metadataEntries.map(entry => ({
        ...entry,
        reportDate: entry.reportDate.toISOString() // Convert Date to string
      }))
    };
  }
  
  return JSON.stringify(serializable);
};

// Helper function to deserialize AggregatedData from localStorage
const deserializeAggregatedData = (serializedData: string): AggregatedData => {
  const parsed = JSON.parse(serializedData);
  const result: AggregatedData = {};
  
  for (const keyword in parsed) {
    const item = parsed[keyword];
    result[keyword] = {
      keyword: item.keyword,
      pointsMap: new Map(Object.entries(item.pointsMap).map(([k, v]) => [parseInt(k, 10), v as number])),
      metadataEntries: item.metadataEntries.map((entry: any) => ({
        ...entry,
        reportDate: new Date(entry.reportDate)
      }))
    };
  }
  
  return result;
};

// Save trend data to localStorage
export const saveTrendDataToLocalStorage = (data: AggregatedData): boolean => {
  try {
    const serializedData = serializeAggregatedData(data);
    localStorage.setItem(STORAGE_KEYS.TREND_DATA, serializedData);
    localStorage.setItem(STORAGE_KEYS.LAST_SAVE_DATE, new Date().toISOString());
    console.log('Trend data saved to localStorage successfully');
    return true;
  } catch (error) {
    console.error('Failed to save trend data to localStorage:', error);
    return false;
  }
};

// Load trend data from localStorage
export const loadTrendDataFromLocalStorage = (): AggregatedData | null => {
  try {
    const serializedData = localStorage.getItem(STORAGE_KEYS.TREND_DATA);
    if (!serializedData) {
      console.log('No trend data found in localStorage');
      return null;
    }
    
    const data = deserializeAggregatedData(serializedData);
    console.log('Trend data loaded from localStorage successfully');
    return data;
  } catch (error) {
    console.error('Failed to load trend data from localStorage:', error);
    return null;
  }
};

// Save settings to localStorage
export const saveSettingsToLocalStorage = (settings: {
  analysisWindow: number;
  maPoints: number;
  seasonalThreshold: number;
  volatilityThreshold: number;
  pinterestApiKey: string;
  geminiApiKey: string;
}): boolean => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    console.log('Settings saved to localStorage successfully');
    return true;
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
    return false;
  }
};

// Load settings from localStorage
export const loadSettingsFromLocalStorage = (): {
  analysisWindow: number;
  maPoints: number;
  seasonalThreshold: number;
  volatilityThreshold: number;
  pinterestApiKey: string;
  geminiApiKey: string;
} | null => {
  try {
    const serializedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!serializedSettings) {
      console.log('No settings found in localStorage');
      return null;
    }
    
    const settings = JSON.parse(serializedSettings);
    console.log('Settings loaded from localStorage successfully');
    return settings;
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
    return null;
  }
};

// Clear all stored data
export const clearLocalStorageData = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEYS.TREND_DATA);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.LAST_SAVE_DATE);
    console.log('All localStorage data cleared successfully');
    return true;
  } catch (error) {
    console.error('Failed to clear localStorage data:', error);
    return false;
  }
};

// Get last save date
export const getLastSaveDate = (): Date | null => {
  try {
    const lastSaveDate = localStorage.getItem(STORAGE_KEYS.LAST_SAVE_DATE);
    if (!lastSaveDate) return null;
    return new Date(lastSaveDate);
  } catch (error) {
    console.error('Failed to get last save date:', error);
    return null;
  }
};

// Check if localStorage is available
export const isLocalStorageAvailable = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    console.warn('localStorage is not available:', error);
    return false;
  }
};

// Get storage usage info
export const getStorageInfo = (): {
  hasData: boolean;
  lastSaveDate: Date | null;
  estimatedSize: string;
} => {
  const hasData = localStorage.getItem(STORAGE_KEYS.TREND_DATA) !== null;
  const lastSaveDate = getLastSaveDate();
  
  let estimatedSize = '0 KB';
  if (hasData) {
    const data = localStorage.getItem(STORAGE_KEYS.TREND_DATA) || '';
    const sizeInBytes = new Blob([data]).size;
    const sizeInKB = Math.round(sizeInBytes / 1024);
    estimatedSize = `${sizeInKB} KB`;
  }
  
  return {
    hasData,
    lastSaveDate,
    estimatedSize
  };
};