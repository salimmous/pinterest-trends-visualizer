
import React, { useMemo } from 'react';
import { KeywordTrendData } from '../types';
import TrendChart from './TrendChart';
import { CHART_LINE_COLORS } from '../constants';

interface KeywordCardProps {
  trendData: KeywordTrendData;
  index: number;
  globallySelectedFilterMonths: string[]; 
  isPeakMonthFilterModeActive: boolean;
}

const TrendDirectionIcon: React.FC<{ direction?: KeywordTrendData['trendDirection'] }> = ({ direction }) => {
  if (direction === 'upward') return <svg className="h-4 w-4 text-green-500 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>;
  if (direction === 'downward') return <svg className="h-4 w-4 text-red-500 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17l5-5m0 0l-5-5m5 5H6" /></svg>;
  if (direction === 'flat') return <svg className="h-4 w-4 text-gray-500 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16" /></svg>;
  return null;
};


const KeywordCard: React.FC<KeywordCardProps> = ({ trendData, index, globallySelectedFilterMonths, isPeakMonthFilterModeActive }) => {
  const { 
    keyword, 
    allPoints,
    latestMetadata, 
    trendDirection, 
    volatility, // This is now Coefficient of Variation
    recentMomentum, 
    trendCategory, 
    maPoints, 
    averageValue,
    seasonalIndexes 
  } = trendData;
  const chartColor = CHART_LINE_COLORS[index % CHART_LINE_COLORS.length];
  
  const xAxisMaxTimestamp = latestMetadata.reportDate instanceof Date ? latestMetadata.reportDate.getTime() : undefined;

  // Filter seasonal indexes for display based on global month filter if it's NOT peak month mode
  // If peak month mode is active, the filtering of cards is done in App.tsx
  // Here, we just display what's given, or all if no filter.
  const displayedSeasonalIndexes = useMemo(() => {
    if (!seasonalIndexes) return [];
    if (isPeakMonthFilterModeActive && globallySelectedFilterMonths.length > 0) {
      // In peak month mode, cards are already filtered. Show all indexes for the card,
      // but highlight only globally selected peak months.
      return seasonalIndexes.map(si => ({
        ...si,
        // highlight if it's a peak month AND selected in global filter
        highlight: si.isPeak && globallySelectedFilterMonths.includes(si.month) 
      }));
    } else if (!isPeakMonthFilterModeActive && globallySelectedFilterMonths.length > 0) {
      // In normal month filter mode, only show selected months' indexes
      return seasonalIndexes.filter(si => globallySelectedFilterMonths.includes(si.month))
                            .map(si => ({...si, highlight: si.isPeak})); // highlight if it's a peak
    }
    // If no filters or not peak mode & no global months, show all, highlighting peaks
    return seasonalIndexes.map(si => ({...si, highlight: si.isPeak}));
  }, [seasonalIndexes, globallySelectedFilterMonths, isPeakMonthFilterModeActive]);


  return (
    <div className="bg-white shadow-lg rounded-xl p-5 hover:shadow-2xl transition-shadow duration-300 flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 capitalize leading-tight">{keyword}</h2>
        {latestMetadata.rank && (
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
            Rank: {latestMetadata.rank}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs text-slate-600 mb-2">
        <p>W: <span className="font-medium text-slate-900">{latestMetadata.weeklyChange || 'N/A'}</span></p>
        <p>M: <span className="font-medium text-slate-900">{latestMetadata.monthlyChange || 'N/A'}</span></p>
        <p>Y: <span className="font-medium text-slate-900">{latestMetadata.yearlyChange || 'N/A'}</span></p>
      </div>
       {latestMetadata.reportDate && latestMetadata.reportDate.getUTCFullYear() > 1970 && (
         <p className="text-xs text-slate-500 mb-3">
           Latest data from: {latestMetadata.reportDate.toLocaleDateString('en-CA', { timeZone: 'UTC' })}
         </p>
       )}
      
      <div className="mb-4 flex-grow min-h-[250px]">
        <TrendChart 
          data={allPoints} 
          maData={maPoints} 
          keyword={keyword} 
          color={chartColor}
          xAxisMaxDate={xAxisMaxTimestamp} 
        />
      </div>
      
      <div className="mt-auto pt-3 border-t border-slate-200">
        <h3 className="text-xs font-semibold text-slate-500 mb-2">Seasonal Performance Index (vs. Annual Avg.):</h3>
        {displayedSeasonalIndexes && displayedSeasonalIndexes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {displayedSeasonalIndexes.map(si => (
              <span
                key={si.month}
                title={`${si.month}: ${si.index}%`}
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  si.highlight ? `ring-2 ring-offset-1 ring-[${chartColor}]` : ''
                }`}
                style={{ 
                  backgroundColor: si.index > 105 ? `${chartColor}35` : (si.index <95 && si.index !==0 ? '#fee2e265' : `${chartColor}15`),
                  color: si.index > 105 ? chartColor : (si.index <95 && si.index !==0 ? '#ef4444' : '#555'),
                  borderColor: si.highlight ? chartColor : 'transparent',
                }}
              >
                {si.month}: {si.index === 0 ? 'N/A' : `${si.index}%`}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Seasonal data not available or filtered out.</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200">
        <h3 className="text-xs font-semibold text-slate-500 mb-2">Trend Analysis (Window):</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center">
            <span className="text-slate-600">Overall:</span>
            <span className="font-medium text-slate-800 ml-1 capitalize flex items-center">
              {trendDirection || 'N/A'} <TrendDirectionIcon direction={trendDirection} />
            </span>
          </div>
          <p className="text-slate-600">Rel. Volatility: <span className="font-medium text-slate-800">{typeof volatility === 'number' ? `${volatility.toFixed(1)}%` : volatility || 'N/A'}</span></p>
          <p className="text-slate-600">Momentum: <span className="font-medium text-slate-800 capitalize">{recentMomentum || 'N/A'}</span></p>
          <p className="text-slate-600">Avg. Value: <span className="font-medium text-slate-800">{typeof averageValue === 'number' ? averageValue.toFixed(2) : averageValue || 'N/A'}</span></p>
          <p className="text-slate-600 col-span-2">Category: <span className="font-medium text-slate-800">{trendCategory || 'N/A'}</span></p>
        </div>
      </div>
    </div>
  );
};

export default KeywordCard;
