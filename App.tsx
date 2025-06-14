
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { KeywordTrendData, AggregatedData, TrendPoint, SeasonalIndexData, TrendMetadata } from './types';
import { parseAndAggregateCsvData } from './services/csvParser';
import { fetchTrendsFromBackend } from './services/pinterestAPIService'; 
import { getGeminiAnalysis, getAdvancedGeminiAnalysis } from './services/geminiAPIService'; // Enhanced AI Analysis
import { 
  saveTrendDataToLocalStorage, 
  loadTrendDataFromLocalStorage, 
  saveSettingsToLocalStorage, 
  loadSettingsFromLocalStorage, 
  clearLocalStorageData, 
  getStorageInfo, 
  isLocalStorageAvailable as checkLocalStorageAvailable 
} from './services/localStorageService'; // New
import KeywordCard from './components/KeywordCard';
import SettingsModal from './components/SettingsModal'; 
import { 
  MONTH_NAMES_FULL, 
  MONTH_NAMES_SHORT, 
  ITEMS_PER_PAGE,
  DEFAULT_ANALYSIS_WINDOW_MONTHS,
  DEFAULT_MA_WINDOW_POINTS,
  DEFAULT_SEASONAL_PEAK_THRESHOLD_PCT,
  DEFAULT_VOLATILITY_CV_THRESHOLD_PCT,
  DEFAULT_PINTEREST_API_KEY, // New
  DEFAULT_GEMINI_API_KEY    // New
} from './constants';


// --- Analytics Helper Functions ---

const calculateLinearRegressionSlope = (points: TrendPoint[]): number | 'N/A' => {
  if (points.length < 2) return 'N/A';
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  points.forEach((point, index) => {
    sumX += index;
    sumY += point.value;
    sumXY += index * point.value;
    sumXX += index * index;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return isNaN(slope) ? 'N/A' : slope;
};

const calculateStandardDeviation = (points: TrendPoint[]): number | 'N/A' => {
  if (points.length < 1) return 'N/A';
  const mean = points.reduce((acc, p) => acc + p.value, 0) / points.length;
  const variance = points.reduce((acc, p) => acc + Math.pow(p.value - mean, 2), 0) / points.length;
  const stdDev = Math.sqrt(variance);
  return isNaN(stdDev) ? 'N/A' : stdDev;
};

const calculateAverageValue = (points: TrendPoint[]): number | 'N/A' => {
  if (points.length === 0) return 'N/A';
  const sum = points.reduce((acc, p) => acc + p.value, 0);
  const avg = sum / points.length;
  return isNaN(avg) ? 'N/A' : parseFloat(avg.toFixed(2));
};

const calculateCoefficientOfVariation = (points: TrendPoint[]): number | 'N/A' => {
  if (points.length < 2) return 'N/A';
  const mean = calculateAverageValue(points);
  const stdDev = calculateStandardDeviation(points);

  if (mean === 'N/A' || stdDev === 'N/A' || mean === 0) return 'N/A';
  if (typeof mean !== 'number' || typeof stdDev !== 'number') return 'N/A';

  const cv = (stdDev / mean) * 100;
  return isNaN(cv) ? 'N/A' : parseFloat(cv.toFixed(2));
};

const calculateRecentMomentum = (points: TrendPoint[]): 'gaining' | 'fading' | 'stable' | 'N/A' => {
  if (points.length < 6) return 'N/A'; 
  const last3Points = points.slice(-3);
  const prev3Points = points.slice(-6, -3);

  if (last3Points.length < 3 || prev3Points.length < 3) return 'N/A';

  const last3MonthsAvg = last3Points.reduce((acc, p) => acc + p.value, 0) / 3;
  const prev3MonthsAvg = prev3Points.reduce((acc, p) => acc + p.value, 0) / 3;

  if (isNaN(last3MonthsAvg) || isNaN(prev3MonthsAvg)) return 'N/A';

  if (last3MonthsAvg > prev3MonthsAvg * 1.1) return 'gaining'; 
  if (last3MonthsAvg < prev3MonthsAvg * 0.9) return 'fading';   
  return 'stable';
};

const categorizeTrend = (
  slope: number | 'N/A',
  momentum: 'gaining' | 'fading' | 'stable' | 'N/A',
  cv: number | 'N/A',
  volatilityCVThresholdPct: number 
): string => {
  if (slope === 'N/A' || momentum === 'N/A') return 'Insufficient Data';

  const isVolatile = typeof cv === 'number' && cv > volatilityCVThresholdPct; 
  let category = '';

  if (slope > 0.5) { 
    if (momentum === 'gaining') category = 'Accelerating Growth';
    else if (momentum === 'stable') category = 'Strong Steady Growth';
    else category = 'Slowing Growth'; 
  } else if (slope > 0.1) { 
    if (momentum === 'gaining') category = 'Moderate Growth, Gaining';
    else if (momentum === 'stable') category = 'Steady Growth';
    else category = 'Growth Stalling';
  } else if (slope < -0.5) { 
    if (momentum === 'fading') category = 'Accelerating Decline';
    else if (momentum === 'stable') category = 'Strong Steady Decline';
    else category = 'Decline Slowing'; 
  } else if (slope < -0.1) { 
    if (momentum === 'fading') category = 'Moderate Decline, Fading';
    else if (momentum === 'stable') category = 'Steady Decline';
    else category = 'Decline Softening';
  } else { 
    if (momentum === 'gaining') category = 'Recent Uptick from Flat';
    else if (momentum === 'stable') category = 'Stable / Flat';
    else category = 'Recent Dip from Flat';
  }
  
  if (category === '') {
      if (slope > 0.1) category = 'Generally Upward';
      else if (slope < -0.1) category = 'Generally Downward';
      else category = 'Generally Flat';
  }

  return isVolatile ? `Volatile ${category}` : category;
};

const calculateMovingAverage = (points: TrendPoint[], windowSize: number): TrendPoint[] => {
  if (points.length < windowSize || windowSize < 2) return []; 
  const maPoints: TrendPoint[] = [];
  for (let i = 0; i < points.length - windowSize + 1; i++) {
    const windowSlice = points.slice(i, i + windowSize);
    const sum = windowSlice.reduce((acc, p) => acc + p.value, 0);
    maPoints.push({
      date: points[i + windowSize - 1].date, 
      value: parseFloat((sum / windowSize).toFixed(2)),
    });
  }
  return maPoints;
};

const calculateSeasonalIndexes = (
  points: TrendPoint[], 
  seasonalPeakThresholdPct: number 
): SeasonalIndexData[] => {
  if (points.length < 12) { 
    return MONTH_NAMES_SHORT.map(month => ({ month, index: 0, isPeak: false }));
  }

  const monthlySums: { [key: number]: { sum: number, count: number } } = {};
  points.forEach(point => {
    const month = new Date(point.date).getUTCMonth(); 
    if (!monthlySums[month]) {
      monthlySums[month] = { sum: 0, count: 0 };
    }
    monthlySums[month].sum += point.value;
    monthlySums[month].count += 1;
  });

  const monthlyAverages = Object.entries(monthlySums).map(([monthKey, data]) => ({
    month: parseInt(monthKey, 10),
    average: data.sum / data.count,
  }));

  const overallAverageValue = calculateAverageValue(points);
  if (overallAverageValue === 'N/A' || overallAverageValue === 0 || typeof overallAverageValue !== 'number') {
     return MONTH_NAMES_SHORT.map(month => ({ month, index: 0, isPeak: false }));
  }
  
  const peakIndexThreshold = 100 + seasonalPeakThresholdPct;

  const seasonalIndexes: SeasonalIndexData[] = MONTH_NAMES_SHORT.map((monthName, i) => {
    const monthData = monthlyAverages.find(ma => ma.month === i);
    if (monthData) {
      const index = parseFloat(((monthData.average / overallAverageValue) * 100).toFixed(1));
      return {
        month: monthName,
        index: isNaN(index) ? 0 : index,
        isPeak: !isNaN(index) && index >= peakIndexThreshold, 
      };
    }
    return { month: monthName, index: 0, isPeak: false };
  });
  
  return seasonalIndexes;
};
// --- End Analytics Helper Functions ---


// Main App Component
const App: React.FC = () => {
  const [rawAggregates, setRawAggregates] = useState<AggregatedData | null>(null);
  const [latestOverallDataDate, setLatestOverallDataDate] = useState<number | null>(null);
  const [currentDataSourceType, setCurrentDataSourceType] = useState<'csv' | 'api' | 'mixed' | null>(null);
  const [displayableTrends, setDisplayableTrends] = useState<KeywordTrendData[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fileNames, setFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [analysisWindowMonths, setAnalysisWindowMonths] = useState<number>(DEFAULT_ANALYSIS_WINDOW_MONTHS);
  const [movingAverageWindowPoints, setMovingAverageWindowPoints] = useState<number>(DEFAULT_MA_WINDOW_POINTS);
  const [seasonalPeakThresholdPct, setSeasonalPeakThresholdPct] = useState<number>(DEFAULT_SEASONAL_PEAK_THRESHOLD_PCT);
  const [volatilityCVThresholdPct, setVolatilityCVThresholdPct] = useState<number>(DEFAULT_VOLATILITY_CV_THRESHOLD_PCT);
  const [pinterestApiKey, setPinterestApiKey] = useState<string>(DEFAULT_PINTEREST_API_KEY); // New
  const [geminiApiKey, setGeminiApiKey] = useState<string>(import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY);       // New

  // Gemini Analysis Modal State
  const [isGeminiAnalysisModalOpen, setIsGeminiAnalysisModalOpen] = useState<boolean>(false);
  const [geminiAnalysisResult, setGeminiAnalysisResult] = useState<string | null>(null);
  const [isAdvancedAnalysis, setIsAdvancedAnalysis] = useState<boolean>(false);

  // LocalStorage State
  const [isLocalStorageAvailable, setIsLocalStorageAvailable] = useState<boolean>(false);
  const [lastSaveDate, setLastSaveDate] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);

  const [analysisStartDate, setAnalysisStartDate] = useState<Date | null>(null);
  const [analysisEndDate, setAnalysisEndDate] = useState<Date | null>(null);
  
  const [activePeakMonthFilter, setActivePeakMonthFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const mergeAggregatedData = (
    existingAggs: AggregatedData | null, 
    newAggs: AggregatedData
  ): AggregatedData => {
    const result: AggregatedData = existingAggs ? JSON.parse(JSON.stringify(existingAggs)) : {};
    
    if (existingAggs) {
        for (const key in result) {
            if (result[key].pointsMap && !(result[key].pointsMap instanceof Map)) {
                 const mapEntries = Object.entries(result[key].pointsMap).map(([ts, val]) => [parseInt(ts, 10), val as number] as [number, number]);
                 result[key].pointsMap = new Map<number, number>(mapEntries);
            }
            result[key].metadataEntries = result[key].metadataEntries.map(m => ({
              ...m,
              reportDate: new Date(m.reportDate) 
            }));
        }
    }

    for (const keyword in newAggs) {
      if (!result[keyword]) {
        result[keyword] = { ...newAggs[keyword], pointsMap: new Map(newAggs[keyword].pointsMap) };
      } else {
        newAggs[keyword].pointsMap.forEach((value, date) => {
          result[keyword].pointsMap.set(date, value);
        });
        result[keyword].metadataEntries = [
          ...result[keyword].metadataEntries, 
          ...newAggs[keyword].metadataEntries
        ].map(m => ({ ...m, reportDate: new Date(m.reportDate) })); // Ensure date objects
      }
    }
    return result;
  };

  const generateDisplayTrends = useCallback((
      currentRawAggregates: AggregatedData | null,
      currentAnalysisStart: Date | null,
      currentAnalysisEnd: Date | null,
      maWindowPoints: number,         
      seasonalPeakPct: number,   
      volatilityThreshPct: number   
    ): KeywordTrendData[] => {
      if (!currentRawAggregates) return [];

      const trendsBase: Omit<KeywordTrendData, 'pointsInAnalysisWindow' | 'maPoints' | 'trendDirection' | 'volatility' | 'recentMomentum' | 'trendCategory' | 'averageValue' | 'seasonalIndexes' | 'primaryPeakMonths'>[] = 
        Object.values(currentRawAggregates).map(aggItem => {
          const sortedPoints: TrendPoint[] = Array.from(aggItem.pointsMap.entries())
            .map(([timestamp, value]) => ({ date: timestamp, value }))
            .sort((a, b) => a.date - b.date);

          let latestMetadata: TrendMetadata | null = null;
          if (aggItem.metadataEntries.length > 0) {
            latestMetadata = aggItem.metadataEntries.reduce((latest, current) => {
                const currentReportDate = current.reportDate instanceof Date ? current.reportDate : new Date(current.reportDate);
                const latestReportDate = latest.reportDate instanceof Date ? latest.reportDate : new Date(latest.reportDate);
                return currentReportDate.getTime() > latestReportDate.getTime() ? current : latest;
            });
            latestMetadata.reportDate = latestMetadata.reportDate instanceof Date ? latestMetadata.reportDate : new Date(latestMetadata.reportDate);
          }
          
          const dataSources = new Set(aggItem.metadataEntries.map(m => m.dataSource));
          let determinedDataSource: 'csv' | 'api' | 'mixed' = 'csv'; 
          if (dataSources.has('api') && dataSources.has('csv')) {
            determinedDataSource = 'mixed';
          } else if (dataSources.has('api')) {
            determinedDataSource = 'api';
          }

          return {
            keyword: aggItem.keyword,
            allPoints: sortedPoints,
            latestMetadata: latestMetadata || { reportDate: new Date(Date.UTC(1970,0,1)), dataSource: determinedDataSource }, 
            dataSource: determinedDataSource,
          };
      });

      return trendsBase.map((trend): KeywordTrendData => {
          const allPointsForKeyword = trend.allPoints; 
          let pointsForAnalysisCalc = allPointsForKeyword;
          if (currentAnalysisStart && currentAnalysisEnd) {
            pointsForAnalysisCalc = allPointsForKeyword.filter(point => 
              point.date >= currentAnalysisStart!.getTime() && point.date <= currentAnalysisEnd!.getTime()
            );
          }

          const slope = calculateLinearRegressionSlope(pointsForAnalysisCalc);
          const cv = calculateCoefficientOfVariation(pointsForAnalysisCalc);
          const momentum = calculateRecentMomentum(pointsForAnalysisCalc); 
          const category = categorizeTrend(slope, momentum, cv, volatilityThreshPct); 
          const movingAveragePoints = calculateMovingAverage(allPointsForKeyword, maWindowPoints); 
          const averageValueInWindow = calculateAverageValue(pointsForAnalysisCalc);
          const seasonalIndexes = calculateSeasonalIndexes(allPointsForKeyword, seasonalPeakPct); 

          let primaryPeakMonths: string[] = [];
          if (seasonalIndexes && seasonalIndexes.length > 0) {
            const maxIndex = Math.max(...seasonalIndexes.map(si => si.index));
            if (maxIndex > 0) { 
                primaryPeakMonths = seasonalIndexes.filter(si => si.index === maxIndex).map(si => si.month);
            }
          }

          return {
            ...trend, 
            pointsInAnalysisWindow: pointsForAnalysisCalc,
            maPoints: movingAveragePoints,
            averageValue: averageValueInWindow,
            trendDirection: slope === 'N/A' ? 'N/A' : (slope > 0.1 ? 'upward' : (slope < -0.1 ? 'downward' : 'flat')),
            volatility: cv,
            recentMomentum: momentum,
            trendCategory: category,
            seasonalIndexes: seasonalIndexes,
            primaryPeakMonths: primaryPeakMonths,
          } as KeywordTrendData; 
        }).filter(trend => trend.allPoints.length > 0)
        .sort((a, b) => { 
          const rankA = a.latestMetadata.rank ?? Infinity;
          const rankB = b.latestMetadata.rank ?? Infinity;
          if (rankA !== rankB) {
            return rankA - rankB;
          }
          return a.keyword.localeCompare(b.keyword);
        });
  }, []);


  useEffect(() => {
    if (!rawAggregates) {
      setDisplayableTrends([]);
      setAnalysisStartDate(null);
      setAnalysisEndDate(null);
      return;
    }

    let currentAnalysisStart: Date | null = null;
    let currentAnalysisEnd: Date | null = null;

    if (latestOverallDataDate) {
      const latestDateObj = new Date(latestOverallDataDate);
      currentAnalysisEnd = new Date(Date.UTC(latestDateObj.getUTCFullYear(), latestDateObj.getUTCMonth() + 1, 0, 23, 59, 59, 999)); 
      currentAnalysisStart = new Date(currentAnalysisEnd);
      currentAnalysisStart.setUTCMonth(currentAnalysisStart.getUTCMonth() - (analysisWindowMonths -1)); 
      currentAnalysisStart.setUTCDate(1);
      currentAnalysisStart.setUTCHours(0, 0, 0, 0);
    }
    setAnalysisStartDate(currentAnalysisStart);
    setAnalysisEndDate(currentAnalysisEnd);

    const trendsToDisplay = generateDisplayTrends(
      rawAggregates, 
      currentAnalysisStart, 
      currentAnalysisEnd,
      movingAverageWindowPoints,      
      seasonalPeakThresholdPct,  
      volatilityCVThresholdPct      
    );
    setDisplayableTrends(trendsToDisplay);

    if (trendsToDisplay.length === 0 && Object.keys(rawAggregates).length > 0 && latestOverallDataDate) {
        const allKeywordsHadNoPointsInWindow = trendsToDisplay.length === 0 && 
            Object.values(rawAggregates).every(aggItem => {
                if (!currentAnalysisStart || !currentAnalysisEnd) return true; 
                return Array.from(aggItem.pointsMap.keys()).filter(date => 
                    date >= currentAnalysisStart!.getTime() && date <= currentAnalysisEnd!.getTime()
                ).length === 0;
            });

        if (allKeywordsHadNoPointsInWindow) {
             setError(`No trend data found within the calculated ${analysisWindowMonths}-month analysis window for any keyword. Uploaded/fetched data might be outside this dynamic range.`);
        }
      } else if (trendsToDisplay.length === 0 && Object.keys(rawAggregates).length > 0 ) {
         setError("No data points to display. Check data or analysis window.");
      } else {
        setError(null); // Clear error if data is successfully displayed
      }
  }, [
    rawAggregates, 
    latestOverallDataDate, 
    generateDisplayTrends, 
    analysisWindowMonths, 
    movingAverageWindowPoints,
    seasonalPeakThresholdPct,
    volatilityCVThresholdPct
  ]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError(null); 
    const newUploadedFileNames = Array.from(files).map(file => file.name);

    const filePromises = Array.from(files).map(file => 
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error(`Error reading file: ${file.name}`));
        reader.readAsText(file);
      })
    );

    try {
      const fileContents = await Promise.all(filePromises);
      if (fileContents.every(content => content.trim() === '')) {
         if (!rawAggregates) {
            setError("All newly selected files are empty.");
         }
         setFileNames(prevFileNames => Array.from(new Set([...prevFileNames, ...newUploadedFileNames])));
         setIsLoading(false);
         return;
      }
      
      // Pass null as existingAggregates because parseAndAggregateCsvData is now just for parsing new files.
      // The merging will happen with the main rawAggregates state.
      const parsedResult = parseAndAggregateCsvData(fileContents, null); 
      const { rawAggregates: newCsvAggregates, latestDataDate: latestDateInNewCSVs } = parsedResult;

      setRawAggregates(prevAggs => mergeAggregatedData(prevAggs, newCsvAggregates));
      
      if (latestDateInNewCSVs) {
        setLatestOverallDataDate(prevDate => prevDate === null || latestDateInNewCSVs > prevDate ? latestDateInNewCSVs : prevDate);
      }

      setCurrentDataSourceType(prevType => (prevType === 'api' || prevType === 'mixed') ? 'mixed' : 'csv');
      setFileNames(prevFileNames => Array.from(new Set([...prevFileNames, ...newUploadedFileNames])));
      setCurrentPage(1);

    } catch (e: any) {
      console.error("Error processing CSV files:", e);
      setError(e.message || "An error occurred while reading/parsing CSV files.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchApiData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // Construct URL with API key if available and not placeholder
      let backendUrl = '/api/pinterest-trends';
      // if (pinterestApiKey && pinterestApiKey !== DEFAULT_PINTEREST_API_KEY) {
      //   backendUrl += `?apiKey=${encodeURIComponent(pinterestApiKey)}`;
      // }
      
      const apiAggregates = await fetchTrendsFromBackend(backendUrl); 
      
      let latestDateInApiData: number | null = null;
      Object.values(apiAggregates).forEach((aggItem) => {
        aggItem.pointsMap.forEach((_value: number, timestamp: number) => {
          if (latestDateInApiData === null || timestamp > latestDateInApiData) {
            latestDateInApiData = timestamp;
          }
        });
      });
      
      setRawAggregates(prevAggs => mergeAggregatedData(prevAggs, apiAggregates));

      if (latestDateInApiData) {
        setLatestOverallDataDate(prevDate => prevDate === null || (latestDateInApiData && latestDateInApiData > prevDate) ? latestDateInApiData : prevDate);
      }
      
      setCurrentDataSourceType(prevType => (prevType === 'csv' || prevType === 'mixed') ? 'mixed' : 'api');
      setFileNames(prevNames => Array.from(new Set([...prevNames, "Pinterest API Data (Backend)"])));
      setCurrentPage(1);

    } catch (e: any) {
      console.error("Error fetching or processing API data:", e);
      setError(`Failed to fetch or process API data. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeminiAnalysis = async (useAdvanced: boolean = false): Promise<void> => {
    if (!geminiApiKey || geminiApiKey === DEFAULT_GEMINI_API_KEY) {
      setError("Please enter your Google Gemini API Key in Settings to use this feature.");
      setIsGeminiAnalysisModalOpen(true);
      setGeminiAnalysisResult(null); // Clear previous results if any
      return;
    }
    if (displayableTrends.length === 0) {
        setError("No trend data available to analyze. Please load some data first.");
        setIsGeminiAnalysisModalOpen(true);
        setGeminiAnalysisResult(null);
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeminiAnalysisResult(null);
    setIsAdvancedAnalysis(useAdvanced);

    try {
      let analysis: string;
      
      if (useAdvanced) {
        // Calculate timeframe
        const allDates = displayableTrends.flatMap(trend => 
          trend.allPoints.map(point => new Date(point.date))
        );
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        const timeframe = `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
        
        const totalDataPoints = displayableTrends.reduce((sum, trend) => sum + trend.allPoints.length, 0);
        
        const analysisInput = {
          trends: displayableTrends.slice(0, 20), // Analyze top 20 trends for advanced analysis
          timeframe,
          totalDataPoints
        };
        
        analysis = await getAdvancedGeminiAnalysis(analysisInput, geminiApiKey);
      } else {
        // Prepare a summary of top trends for basic analysis
        const topTrendsSummary: string = displayableTrends
          .slice(0, 5) // Take top 5 trends for brevity
          .map((t: KeywordTrendData) => `${t.keyword} (Category: ${t.trendCategory}, Momentum: ${t.recentMomentum}, Avg: ${t.averageValue})`)
          .join('; ');
        
        analysis = await getGeminiAnalysis(topTrendsSummary, geminiApiKey);
      }
      
      setGeminiAnalysisResult(analysis);
    } catch (e: any) {
      console.error("Error getting Gemini analysis:", e);
      setGeminiAnalysisResult("Failed to get AI analysis. Check console for details.");
    } finally {
      setIsLoading(false);
      setIsGeminiAnalysisModalOpen(true);
    }
  };


  const handleClearData = useCallback(() => {
    setRawAggregates(null);
    setLatestOverallDataDate(null);
    setCurrentDataSourceType(null);
    setDisplayableTrends([]); 
    
    setSearchTerm('');
    setError(null);
    setFileNames([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(false);
    setAnalysisStartDate(null);
    setAnalysisEndDate(null);
    setActivePeakMonthFilter(null); 
    setCurrentPage(1);
    setGeminiAnalysisResult(null);
    setIsGeminiAnalysisModalOpen(false);
    
    // Clear localStorage data
    if (isLocalStorageAvailable) {
      clearLocalStorageData();
      setLastSaveDate(null);
    }
    // Reset API keys to default placeholders - user might not want this, debatable
    // setPinterestApiKey(DEFAULT_PINTEREST_API_KEY);
    // setGeminiApiKey(DEFAULT_GEMINI_API_KEY);
  }, [isLocalStorageAvailable]);
  
  const handleManualSave = useCallback((): void => {
    if (isLocalStorageAvailable && rawAggregates) {
      const saveSuccess: boolean = saveTrendDataToLocalStorage(rawAggregates);
      if (saveSuccess) {
        const storageInfo = getStorageInfo();
        setLastSaveDate(storageInfo.lastSaveDate);
      }
    }
  }, [isLocalStorageAvailable, rawAggregates]);
  
  const toggleAutoSave = useCallback((): void => {
    setAutoSaveEnabled(prev => !prev);
  }, []);
  
  const handleMonthPeakFilterClick = (month: string): void => {
    setActivePeakMonthFilter(prev => prev === month ? null : month);
  };

  const handleClearMonthPeakFilter = (): void => {
    setActivePeakMonthFilter(null);
  };
  
  // Initialize localStorage and load saved data on app startup
  useEffect(() => {
    const initializeLocalStorage = () => {
      const available = checkLocalStorageAvailable();
      setIsLocalStorageAvailable(available);
      
      if (available) {
        // Load saved settings
        const savedSettings = loadSettingsFromLocalStorage();
        if (savedSettings) {
          setAnalysisWindowMonths(savedSettings.analysisWindow);
          setMovingAverageWindowPoints(savedSettings.maPoints);
          setSeasonalPeakThresholdPct(savedSettings.seasonalThreshold);
          setVolatilityCVThresholdPct(savedSettings.volatilityThreshold);
          setPinterestApiKey(savedSettings.pinterestApiKey);
          setGeminiApiKey(savedSettings.geminiApiKey);
        }
        
        // Load saved trend data
        const savedTrendData = loadTrendDataFromLocalStorage();
        if (savedTrendData) {
          setRawAggregates(savedTrendData);
          
          // Calculate latest data date
          let latestDate: number | null = null;
          Object.values(savedTrendData).forEach((aggItem) => {
            aggItem.pointsMap.forEach((_value: number, timestamp: number) => {
              if (latestDate === null || timestamp > latestDate) {
                latestDate = timestamp;
              }
            });
          });
          setLatestOverallDataDate(latestDate);
          
          // Determine data source type
          const dataSources = new Set<string>();
          Object.values(savedTrendData).forEach((aggItem) => {
            aggItem.metadataEntries.forEach((entry) => {
              dataSources.add(entry.dataSource);
            });
          });
          
          if (dataSources.has('api') && dataSources.has('csv')) {
            setCurrentDataSourceType('mixed');
          } else if (dataSources.has('api')) {
            setCurrentDataSourceType('api');
          } else {
            setCurrentDataSourceType('csv');
          }
          
          setFileNames(['Loaded from localStorage']);
        }
        
        // Update last save date
        const storageInfo = getStorageInfo();
        setLastSaveDate(storageInfo.lastSaveDate);
      }
    };
    
    initializeLocalStorage();
  }, []);

  // Auto-save trend data when it changes
  useEffect(() => {
    if (isLocalStorageAvailable && autoSaveEnabled && rawAggregates) {
      const saveSuccess: boolean = saveTrendDataToLocalStorage(rawAggregates);
      if (saveSuccess) {
        const storageInfo = getStorageInfo();
        setLastSaveDate(storageInfo.lastSaveDate);
      }
    }
  }, [rawAggregates, isLocalStorageAvailable, autoSaveEnabled]);

  useEffect(() => { 
    setCurrentPage(1);
  }, [searchTerm, activePeakMonthFilter, currentDataSourceType]);


  const monthPeakCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    MONTH_NAMES_SHORT.forEach(month => counts[month] = 0);

    // Calculate counts based on displayableTrends BEFORE search/month filtering for a global overview
    // but AFTER initial processing (generateDisplayTrends)
    const trendsForCounting = generateDisplayTrends(
        rawAggregates, 
        analysisStartDate, 
        analysisEndDate, 
        movingAverageWindowPoints, 
        seasonalPeakThresholdPct, 
        volatilityCVThresholdPct
    );

    trendsForCounting.forEach((trend: KeywordTrendData) => { 
        trend.primaryPeakMonths?.forEach((peakMonth: string) => {
            if (counts[peakMonth] !== undefined) {
                counts[peakMonth]++;
            }
        });
    });
    return counts;
  }, [rawAggregates, analysisStartDate, analysisEndDate, movingAverageWindowPoints, seasonalPeakThresholdPct, volatilityCVThresholdPct, generateDisplayTrends]);


  const filteredTrends = useMemo(() => {
    let trendsToFilter = displayableTrends;
    
    if (searchTerm) {
      trendsToFilter = trendsToFilter.filter((trend: KeywordTrendData) =>
        trend.keyword.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (activePeakMonthFilter) {
      trendsToFilter = trendsToFilter.filter((trend: KeywordTrendData) => 
        trend.primaryPeakMonths?.includes(activePeakMonthFilter)
      );
    }
    return trendsToFilter;

  }, [displayableTrends, searchTerm, activePeakMonthFilter]);

  const finalTrendsToDisplayPaginated = filteredTrends; 

  const totalPages = Math.ceil(finalTrendsToDisplayPaginated.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTrends = finalTrendsToDisplayPaginated.slice(startIndex, endIndex);

  const handleNextPage = (): void => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };
  const handlePrevPage = (): void => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  const handleGoToPage = (page: number): void => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const PaginationControls = (): React.JSX.Element | null => {
    if (totalPages <= 1) return null;
    
    const pageNumbers: (number | string)[] = [];
    const maxPageButtons = 5; 
    
    if (totalPages <= maxPageButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > 3) {
        pageNumbers.push('...');
      }
      
      let startPageNumRange = Math.max(2, currentPage - 1);
      let endPageNumRange = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        endPageNumRange = Math.min(totalPages -1, maxPageButtons - 2)
      } else if (currentPage >= totalPages - 2) {
        startPageNumRange = Math.max(2, totalPages - (maxPageButtons - 3))
      }

      for (let i = startPageNumRange; i <= endPageNumRange; i++) {
        pageNumbers.push(i);
      }

      if (currentPage < totalPages - 2) {
         pageNumbers.push('...');
      }
      pageNumbers.push(totalPages);
    }
    return (
      <div className="flex justify-center items-center space-x-2 my-8">
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          className="py-2 px-4 bg-pink-500 hover:bg-pink-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors flex items-center"
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          Prev
        </button>
        {pageNumbers.map((page: number | string, index: number) => (
          page === '...' ? 
          <span key={`ellipsis-${index}`} className="px-4 py-2 text-slate-500">...</span> :
          <button
            key={page}
            onClick={() => handleGoToPage(page as number)}
            className={`py-2 px-4 rounded-lg transition-colors font-medium text-sm
              ${currentPage === page ? 'bg-pink-600 text-white scale-110 shadow-lg' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}
            `}
          >
            {page}
          </button>
        ))}
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          className="py-2 px-4 bg-pink-500 hover:bg-pink-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors flex items-center"
        >
          Next
          <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    );
  };


  const iconClass = "h-5 w-5 inline-block mr-2";
  const analysisPeriodString = analysisStartDate && analysisEndDate 
    ? `Analytics Window: ${MONTH_NAMES_FULL[analysisStartDate.getUTCMonth()]} ${analysisStartDate.getUTCFullYear()} to ${MONTH_NAMES_FULL[analysisEndDate.getUTCMonth()]} ${analysisEndDate.getUTCFullYear()} (${analysisWindowMonths} months)`
    : "Upload/fetch data to establish analysis period.";

  const noResultsIconPath = searchTerm
    ? "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
    : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"; 

  let dataSourceDisplayText = 'No data loaded';
  let dataSourceDisplayClass = 'text-slate-600';
  if (currentDataSourceType === 'csv') {
    dataSourceDisplayText = 'Uploaded CSV Data';
    dataSourceDisplayClass = 'bg-green-100 text-green-700';
  } else if (currentDataSourceType === 'api') {
    dataSourceDisplayText = 'Pinterest API Data (Backend)';
    dataSourceDisplayClass = 'bg-sky-100 text-sky-700';
  } else if (currentDataSourceType === 'mixed') {
    dataSourceDisplayText = 'CSV + API Data (Mixed)';
    dataSourceDisplayClass = 'bg-orange-100 text-orange-700';
  }

  const handleSaveSettings = (newSettings: {
    analysisWindow: number;
    maPoints: number;
    seasonalThreshold: number;
    volatilityThreshold: number;
    pinterestApiKey: string; // New
    geminiApiKey: string;    // New
  }): void => {
    setAnalysisWindowMonths(newSettings.analysisWindow);
    setMovingAverageWindowPoints(newSettings.maPoints);
    setSeasonalPeakThresholdPct(newSettings.seasonalThreshold);
    setVolatilityCVThresholdPct(newSettings.volatilityThreshold);
    setPinterestApiKey(newSettings.pinterestApiKey); // New
    setGeminiApiKey(newSettings.geminiApiKey);       // New
    
    // Save settings to localStorage
    if (isLocalStorageAvailable) {
      saveSettingsToLocalStorage(newSettings);
    }
    
    setIsSettingsModalOpen(false);
  };

  // Enhanced Gemini Analysis Modal Component
  const GeminiAnalysisModal: React.FC = () => {
    if (!isGeminiAnalysisModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              🤖 {isAdvancedAnalysis ? 'Advanced' : 'Basic'} AI Trend Analysis
              <span className="text-sm font-normal text-slate-500 ml-2">(Simulated)</span>
            </h2>
            <button onClick={() => setIsGeminiAnalysisModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mr-3"></div>
              <p className="text-slate-500">
                {isAdvancedAnalysis ? 'Generating advanced AI analysis...' : 'Generating analysis...'}
              </p>
            </div>
          )}
          
          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          
          {!isLoading && geminiAnalysisResult && (
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                {geminiAnalysisResult}
              </div>
            </div>
          )}
          
          {!isLoading && !geminiAnalysisResult && !error && (
             <p className="text-slate-500 text-center py-8">No analysis result to display.</p>
          )}
          
          <div className="flex gap-3 mt-6">
            {!isLoading && (
              <>
                <button
                  onClick={() => handleGeminiAnalysis(false)}
                  disabled={!displayableTrends.length || (!geminiApiKey || geminiApiKey === DEFAULT_GEMINI_API_KEY)}
                  className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
                >
                  🔍 Basic Analysis
                </button>
                <button
                  onClick={() => handleGeminiAnalysis(true)}
                  disabled={!displayableTrends.length || (!geminiApiKey || geminiApiKey === DEFAULT_GEMINI_API_KEY)}
                  className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
                >
                  🚀 Advanced Analysis
                </button>
              </>
            )}
            <button
              onClick={() => setIsGeminiAnalysisModalOpen(false)}
              className="py-2 px-6 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <header className="bg-slate-900 text-white p-6 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Pinterest Trends Visualizer
            </h1>
            <p className="text-slate-300 mt-1 text-sm">
              Analyze keyword trends from CSVs or API.
            </p>
          </div>
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors"
            aria-label="Open Settings"
          >
            <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 bg-white shadow-xl rounded-lg p-6">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Data Sources & AI Analysis</h2>
            <label htmlFor="csvUpload" 
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors mb-3">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-2 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <p className="text-sm text-slate-500"><span className="font-semibold">Upload CSVs</span></p>
              </div>
              <input id="csvUpload" ref={fileInputRef} type="file" multiple accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
            
            <button
                onClick={handleFetchApiData}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center mb-3"
              >
                 <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3.5a1.5 1.5 0 01.852 2.845A3.501 3.501 0 0113.5 9.5H10V3.5z" />
                    <path d="M10 3.5V9.5a3.5 3.5 0 01-2.648-5.655A1.5 1.5 0 0110 3.5zM6.5 10a3.5 3.5 0 005.654 2.648A1.5 1.5 0 0010 10.5V10H6.5zM10.5 10V10.5a1.5 1.5 0 002.147 1.252A3.5 3.5 0 0010.5 10zM10 16.5a1.5 1.5 0 01-1.252-.853A3.501 3.501 0 016.5 10.5H10v6z" />
                    <path d="M10 16.5V10.5a3.5 3.5 0 012.648 5.655A1.5 1.5 0 0110 16.5z" />
                 </svg>
                Fetch Trends from API (Backend)
            </button>

             <button
                onClick={() => {
                  setIsGeminiAnalysisModalOpen(true);
                  setGeminiAnalysisResult(null);
                  setError(null);
                }}
                disabled={!displayableTrends.length || (!geminiApiKey || geminiApiKey === DEFAULT_GEMINI_API_KEY)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center mb-3 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                title={(!geminiApiKey || geminiApiKey === DEFAULT_GEMINI_API_KEY) ? "Set Gemini API Key in Settings" : "Get AI Analysis"}
              >
                 <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.292 2.048a.75.75 0 00-1.034-.235L6.5 3.82a.75.75 0 00-.5.68v1.028a.75.75 0 01-1.5 0V4.5a2.25 2.25 0 012.035-2.234l3.75-1.51a2.25 2.25 0 013.101.683L16.5 4.075V3.75a.75.75 0 011.5 0v2.75a.75.75 0 01-.75.75h-2.75a.75.75 0 010-1.5h1.028a.75.75 0 00.68-.5L13.448 2.86a.75.75 0 00-.234-.628l-.923-.923zM4.014 8.25a.75.75 0 00-1.029.247l-1.5 2.25A.75.75 0 002.25 12h1.25a.75.75 0 010 1.5H2.25a.75.75 0 00-.716.997l1.5 2.25a.75.75 0 001.03.247l2.25-1.5a.75.75 0 000-1.244l-2.25-1.5a.75.75 0 00-.05-.028zM10 8.25a.75.75 0 000 1.5h3.75a.75.75 0 000-1.5H10zm0 3a.75.75 0 000 1.5h3.75a.75.75 0 000-1.5H10zm0 3a.75.75 0 000 1.5h3.75a.75.75 0 000-1.5H10z" clipRule="evenodd" /></svg>
                🤖 Analyze Trends with AI
            </button>

            {fileNames.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">
                  Current Data Source(s): <span className={`font-medium px-2 py-0.5 rounded text-xs ${dataSourceDisplayClass}`}>{dataSourceDisplayText}</span>
                </h3>
                {fileNames.filter(name => !name.toLowerCase().includes("api data")).length > 0 && (
                  <>
                    <p className="text-xs text-slate-500 mt-1">Uploaded CSVs:</p>
                    <div className="max-h-20 overflow-y-auto bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <ul className="space-y-1">
                          {fileNames.filter(name => !name.toLowerCase().includes("api data")).map(name => (
                            <li key={name} className="truncate flex items-center text-slate-600">
                               <svg className="h-3.5 w-3.5 text-green-500 mr-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              {name}
                            </li>))}
                        </ul>
                      </div>
                  </>
                )}
              </div>
            )}
            
            {/* LocalStorage Status */}
            {isLocalStorageAvailable && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-sm font-semibold text-green-800 mb-2">Local Storage</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-green-700">Auto-save:</span>
                      <button
                        onClick={toggleAutoSave}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          autoSaveEnabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {autoSaveEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <button
                      onClick={handleManualSave}
                      disabled={!rawAggregates}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Save Now
                    </button>
                  </div>
                  {lastSaveDate && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-green-700">Last saved:</span>
                      <span className="text-xs text-green-600">
                        {lastSaveDate.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <button
                onClick={handleClearData}
                disabled={!currentDataSourceType}
                className="mt-4 w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
              >
                <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                Clear All Data
              </button>
          </div>

          {/* Filters Column */}
          <div className="lg:col-span-2 bg-white shadow-xl rounded-lg p-6">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Filters & Search</h2>
            <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search displayed keywords..."
                  className="w-full p-3 rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 border border-slate-300 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search trends"
                  disabled={!displayableTrends.length && !rawAggregates}
                />
            </div>
             <div>
                <h3 className="text-md font-semibold text-slate-600 mb-2">Filter by Primary Peak Month:</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
                  {MONTH_NAMES_SHORT.map(month => (
                    <button
                      key={month}
                      onClick={() => handleMonthPeakFilterClick(month)}
                      disabled={(!displayableTrends.length && !rawAggregates) || monthPeakCounts[month] === 0}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1
                        ${activePeakMonthFilter === month 
                          ? 'bg-pink-600 text-white shadow-md scale-105' 
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed'}
                      `}
                      aria-pressed={activePeakMonthFilter === month}
                    >
                      {month} ({monthPeakCounts[month] !== undefined ? monthPeakCounts[month] : 0})
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleClearMonthPeakFilter}
                  disabled={!activePeakMonthFilter}
                  className="py-2 px-3 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center sm:w-auto"
                >
                   <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                   </svg>
                  Clear Month Filter
                </button>
              </div>
          </div>
        </div>
        
        <div className="text-center my-4 p-2 bg-indigo-50 text-indigo-700 rounded-md text-sm">
          {analysisPeriodString}
        </div>

        {isLoading && !isGeminiAnalysisModalOpen && ( // Don't show main loading if gemini modal is open and loading
          <div className="flex flex-col justify-center items-center h-64 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-500 mb-4"></div>
            <p className="text-xl text-slate-600">Processing data...</p>
          </div>
        )}

        {error && !isGeminiAnalysisModalOpen && ( // Don't show main error if gemini modal is open and shows error
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {(displayableTrends.length === 0 || (finalTrendsToDisplayPaginated.length === 0 && displayableTrends.length > 0 && (searchTerm || activePeakMonthFilter))) && currentDataSourceType && (
               <div className="text-center text-slate-500 py-10">
                  <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={noResultsIconPath}/>
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-slate-800">
                    {searchTerm && finalTrendsToDisplayPaginated.length === 0 ? "No Results Found" : "No Trend Data to Display"}
                  </h3>
                   <p className="mt-1 text-sm text-slate-500">
                    {searchTerm && finalTrendsToDisplayPaginated.length === 0 
                      ? `No trends match your search term "${searchTerm}" with the current filters.` 
                      : `No data matches your current filter criteria. Try adjusting filters or loading different data.`
                    }
                  </p>
               </div>
            )}
            {!currentDataSourceType && ( 
              <div className="text-center text-slate-500 py-10">
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-slate-800">No Data to Display</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Please upload Pinterest Trends CSV files or fetch data from the API to visualize trends.
                </p>
              </div>
            )}
            
            {paginatedTrends.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedTrends.map((trend: KeywordTrendData, cardRenderIndex: number) => (
                    <KeywordCard 
                      key={`${trend.keyword}-${trend.dataSource}-${trend.latestMetadata.reportDate.toISOString()}-${startIndex + cardRenderIndex}`} 
                      trendData={trend} 
                      index={startIndex + cardRenderIndex} 
                      globallySelectedFilterMonths={[]} 
                      isPeakMonthFilterModeActive={false} 
                    />
                  ))}
                </div>
                <PaginationControls />
              </>
            )}
          </>
        )}
      </main>
      
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentSettings={{
          analysisWindow: analysisWindowMonths,
          maPoints: movingAverageWindowPoints,
          seasonalThreshold: seasonalPeakThresholdPct,
          volatilityThreshold: volatilityCVThresholdPct,
          pinterestApiKey: pinterestApiKey, // New
          geminiApiKey: geminiApiKey        // New
        }}
        onSave={handleSaveSettings}
      />

      <GeminiAnalysisModal />

      <footer className="text-center py-8 border-t border-slate-200 bg-slate-800 text-slate-400">
        <p className="text-sm">
          Pinterest Trends Visualizer | Dynamic Analytics & Filtering
        </p>
      </footer>
    </div>
  );
};

export default App;
