
export interface TrendPoint {
  date: number; // Timestamp
  value: number;
}

export interface TrendMetadata {
  rank?: number;
  weeklyChange?: string;
  monthlyChange?: string;
  yearlyChange?: string;
  reportDate: Date; // Will be Date object on frontend
  dataSource: 'csv' | 'api' | 'mixed'; 
}

export interface SeasonalIndexData {
  month: string; 
  index: number; 
  isPeak: boolean; 
}

export interface KeywordTrendData {
  keyword: string;
  allPoints: TrendPoint[]; 
  pointsInAnalysisWindow: TrendPoint[]; 
  latestMetadata: TrendMetadata;
  maPoints?: TrendPoint[]; 
  dataSource: 'csv' | 'api' | 'mixed'; 
  
  trendDirection?: 'upward' | 'downward' | 'flat' | 'N/A';
  volatility?: number | 'N/A'; 
  recentMomentum?: 'gaining' | 'fading' | 'stable' | 'N/A';
  trendCategory?: string;
  averageValue?: number | 'N/A'; 
  seasonalIndexes?: SeasonalIndexData[];
  primaryPeakMonths?: string[]; // Added this line
}

// Intermediate structure for raw aggregated data before full KeywordTrendData conversion
// PointsMap will be { timestamp: value } for easier JSON transport from backend
export interface AggregatedDataPointMapForTransport {
  [timestamp: number]: number;
}
export interface AggregatedDataEntryForTransport {
  keyword: string;
  pointsMap: AggregatedDataPointMapForTransport; // Key: timestamp (number), Value: number
  metadataEntries: { // Metadata entries ready for transport
    rank?: number;
    weeklyChange?: string;
    monthlyChange?: string;
    yearlyChange?: string;
    reportDate: string; // ISO string
    dataSource: 'csv' | 'api';
  }[];
}
export type AggregatedDataForTransport = Record<string, AggregatedDataEntryForTransport>;


// Structure used internally in the frontend after parsing/fetching & reconstituting
export type AggregatedData = Record<
  string,
  {
    keyword: string;
    pointsMap: Map<number, number>; // Date timestamp to value
    metadataEntries: TrendMetadata[]; // Contains Date objects
  }
>;

export interface ProcessedData {
  trends: KeywordTrendData[]; // What's displayed in cards
  rawAggregates: AggregatedData; // Added to store intermediate aggregated data
  latestDataDate: number | null; 
  dataSourceType: 'csv' | 'api' | 'mixed' | null; 
}