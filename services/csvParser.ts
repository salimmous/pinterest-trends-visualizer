
import Papa from 'papaparse';
import { AggregatedData, KeywordTrendData, TrendMetadata, TrendPoint, ProcessedData } from '../types';
import { parseDateToTimestamp } from '../constants';

const getReportDateFromCsvContent = (csvContent: string): Date => {
  const firstLine = (csvContent || "").split(/\r\n|\n|\r/)[0] || "";
  const endDateMatch = firstLine.match(/endDate=(\d{4}-\d{2}-\d{2})/);
  if (endDateMatch && endDateMatch[1]) {
    const dateStr = endDateMatch[1];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      const date = new Date(Date.UTC(year, month, day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  console.warn(`Could not find or parse report date in CSV content starting with: ${firstLine.substring(0, 100)}. Using fallback date.`);
  return new Date(Date.UTC(1970, 0, 1)); // Fallback date
};

const findHeaderRowIndex = (data: string[][]): number => {
  return data.findIndex(row =>
    row.some(cell => cell?.toLowerCase().trim() === 'rank') &&
    row.some(cell => cell?.toLowerCase().trim() === 'trend') &&
    row.some(cell => /\d{4}-\d{2}-\d{2}/.test(cell))
  );
};


export const parseAndAggregateCsvData = (
  csvFileContents: string[],
  existingAggregatedData: AggregatedData | null
): ProcessedData => {
  const aggregatedData: AggregatedData = {};

  if (existingAggregatedData) {
    for (const keyword in existingAggregatedData) {
      aggregatedData[keyword] = {
        ...existingAggregatedData[keyword],
        pointsMap: new Map(existingAggregatedData[keyword].pointsMap),
        metadataEntries: existingAggregatedData[keyword].metadataEntries.map(entry => ({
          ...entry,
          reportDate: new Date(entry.reportDate.getTime()) // Ensure date is a Date object
        }))
      };
    }
  }
  
  let overallLatestDateTimestamp: number | null = null;
  if (existingAggregatedData) {
    Object.values(existingAggregatedData).forEach((aggItem) => {
      aggItem.pointsMap.forEach((_value: number, timestamp: number) => {
        if (overallLatestDateTimestamp === null || timestamp > overallLatestDateTimestamp) {
          overallLatestDateTimestamp = timestamp;
        }
      });
    });
  }

  csvFileContents.forEach((csvContent, csvIndex) => {
    const reportDate = getReportDateFromCsvContent(csvContent);
    
    const { data: rawDataArray, errors } = Papa.parse<string[]>(csvContent, {
      skipEmptyLines: true,
      dynamicTyping: false, 
    });

    if (errors.length > 0) {
      console.warn(`CSV file ${csvIndex + 1}: Papaparse encountered errors:`, errors);
    }

    if (!rawDataArray || rawDataArray.length === 0) {
        console.warn(`CSV file ${csvIndex + 1}: Papaparse returned no data. Skipping file.`);
        return;
    }

    const headerRowIndex = findHeaderRowIndex(rawDataArray);

    if (headerRowIndex === -1) {
      console.warn(`CSV file ${csvIndex + 1}: Could not find a valid header row. Skipping file.`);
      return;
    }
    
    const rawHeaders = rawDataArray[headerRowIndex];
    const actualHeaders = rawHeaders.map((h: string) => (h || "").trim().toLowerCase());
    const dataRowsAsObjects: Record<string, string>[] = [];

    for (let i = headerRowIndex + 1; i < rawDataArray.length; i++) {
      const rowArray = rawDataArray[i];
      const rowObject: Record<string, string> = {};
      actualHeaders.forEach((header: string, j: number) => {
        rowObject[header] = rowArray[j];
      });
      dataRowsAsObjects.push(rowObject);
    }
    
    const rankKey = actualHeaders.find((h: string) => h.includes('rank'));
    const keywordKey = actualHeaders.find((h: string) => h.includes('trend'));
    const weeklyChangeKey = actualHeaders.find((h: string) => h.includes('weekly change'));
    const monthlyChangeKey = actualHeaders.find((h: string) => h.includes('monthly change'));
    const yearlyChangeKey = actualHeaders.find((h: string) => h.includes('yearly change'));
    
    if (!keywordKey) {
      console.warn(`CSV file ${csvIndex + 1}: 'Trend' (keyword) column not found in detected headers: ${actualHeaders.join(', ')}. Skipping file.`);
      return;
    }

    const dateColumns: { headerKey: string; dateObj: Date }[] = [];
    actualHeaders.forEach((headerKey: string) => {
      const isMetadataColumn = [rankKey, keywordKey, weeklyChangeKey, monthlyChangeKey, yearlyChangeKey].includes(headerKey);
      if (!isMetadataColumn) {
         const originalHeaderIndex = actualHeaders.indexOf(headerKey);
         const originalHeaderValue = rawHeaders[originalHeaderIndex];
         const dateTimestamp = parseDateToTimestamp(originalHeaderValue);
        if (dateTimestamp) {
          dateColumns.push({ headerKey, dateObj: new Date(dateTimestamp) });
        }
      }
    });

    if (dateColumns.length === 0 && dataRowsAsObjects.length > 0) {
      console.warn(`CSV file ${csvIndex + 1}: No valid date columns found in header. Headers: ${actualHeaders.join(', ')}`);
    }

    dataRowsAsObjects.forEach((row: Record<string, string>) => {
      const keyword = row[keywordKey]?.trim();
      if (!keyword) return;

      if (!aggregatedData[keyword]) {
        aggregatedData[keyword] = {
          keyword: keyword,
          pointsMap: new Map<number, number>(),
          metadataEntries: [],
        };
      }
      
      const rankStr = rankKey ? row[rankKey] : undefined;
      const rank = rankStr ? parseInt(rankStr.replace(/,/g, ''), 10) : undefined;

      aggregatedData[keyword].metadataEntries.push({
        rank: (rank !== undefined && !isNaN(rank)) ? rank : undefined,
        weeklyChange: weeklyChangeKey ? row[weeklyChangeKey] : undefined,
        monthlyChange: monthlyChangeKey ? row[monthlyChangeKey] : undefined,
        yearlyChange: yearlyChangeKey ? row[yearlyChangeKey] : undefined,
        reportDate: reportDate,
        dataSource: 'csv' 
      });

      dateColumns.forEach((col: { headerKey: string; dateObj: Date }) => {
        const valueStr = row[col.headerKey];
        if (valueStr !== undefined && valueStr.trim() !== '') {
          const value = parseInt(valueStr.replace(/,/g, ''), 10);
          if (!isNaN(value)) {
            const timestamp = col.dateObj.getTime();
            aggregatedData[keyword].pointsMap.set(timestamp, value);
            if (overallLatestDateTimestamp === null || timestamp > overallLatestDateTimestamp) {
              overallLatestDateTimestamp = timestamp;
            }
          }
        }
      });
    });
  });
  
  // Map aggregated data to KeywordTrendData structure for App.tsx
  const trendsResult: Omit<KeywordTrendData, 'pointsInAnalysisWindow' | 'maPoints' | 'trendDirection' | 'volatility' | 'recentMomentum' | 'trendCategory' | 'averageValue' | 'seasonalIndexes'>[] = 
    Object.values(aggregatedData).map(aggItem => {
      const sortedPoints: TrendPoint[] = Array.from(aggItem.pointsMap.entries())
        .map(([timestamp, value]: [number, number]) => ({ date: timestamp, value }))
        .sort((a: TrendPoint, b: TrendPoint) => a.date - b.date);

      let latestMetadata: TrendMetadata = { reportDate: new Date(Date.UTC(1970,0,1)), dataSource: 'csv' };
      if (aggItem.metadataEntries.length > 0) {
        latestMetadata = aggItem.metadataEntries.reduce((latest: TrendMetadata, current: TrendMetadata) => {
            const currentReportDate = current.reportDate instanceof Date ? current.reportDate : new Date(current.reportDate);
            const latestReportDate = latest.reportDate instanceof Date ? latest.reportDate : new Date(latest.reportDate);
            return currentReportDate.getTime() > latestReportDate.getTime() ? current : latest;
          }
        );
        latestMetadata.reportDate = latestMetadata.reportDate instanceof Date ? latestMetadata.reportDate : new Date(latestMetadata.reportDate);
      }
      
      return {
        keyword: aggItem.keyword,
        allPoints: sortedPoints, // This now correctly represents all points for the keyword
        latestMetadata: latestMetadata,
        dataSource: 'csv' as 'csv' // Explicitly type dataSource as 'csv'
      };
    }).sort((a, b) => {
      const rankA = a.latestMetadata.rank ?? Infinity;
      const rankB = b.latestMetadata.rank ?? Infinity;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.keyword.localeCompare(b.keyword);
    });
  
  // Cast to full KeywordTrendData[] - other fields will be populated in App.tsx
  const finalTrends = trendsResult as unknown as KeywordTrendData[];

  return { 
    trends: finalTrends, 
    rawAggregates: aggregatedData, 
    latestDataDate: overallLatestDateTimestamp,
    dataSourceType: 'csv' 
  };
};