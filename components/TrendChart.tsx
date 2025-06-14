import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendPoint } from '../types';
import { MA_LINE_COLOR } from '../constants';


interface TrendChartProps {
  data: TrendPoint[];
  maData?: TrendPoint[];
  keyword: string;
  color: string;
  xAxisMaxDate?: number; // Timestamp for the maximum extent of the X-axis
}

const TrendChart: React.FC<TrendChartProps> = ({ data, maData, keyword, color, xAxisMaxDate }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500 py-4">No data available for this trend.</p>;
  }

  const formatXAxis = (tickItem: number) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const lastDataPointDate = data.length > 0 ? data[data.length - 1].date : null;
  // Show reference line if xAxisMaxDate is present, later than the last data point,
  // and there's a noticeable gap (e.g., more than 1 day).
  const showReferenceLine = xAxisMaxDate && lastDataPointDate && xAxisMaxDate > (lastDataPointDate + 24 * 60 * 60 * 1000);


  const finalXAxisDomainMax = useMemo(() => {
    if (!data || data.length === 0) {
      return xAxisMaxDate || 'auto';
    }
    const maxDataTimestamp = data[data.length - 1].date;
    if (xAxisMaxDate) {
      return Math.max(maxDataTimestamp, xAxisMaxDate);
    }
    return maxDataTimestamp;
  }, [data, xAxisMaxDate]);
  
  const finalXAxisDomainMin = useMemo(() => {
    if (!data || data.length === 0) {
        return xAxisMaxDate ? 'auto' : 'auto'; 
    }
    return data[0].date;
  }, [data, xAxisMaxDate]);


  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="99%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis} 
            angle={-30} 
            textAnchor="end" 
            height={50} 
            tick={{ fontSize: 10, fill: '#666' }}
            interval="preserveStartEnd"
            domain={[finalXAxisDomainMin, finalXAxisDomainMax]}
            type="number" 
            allowDataOverflow={true} 
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.5rem', borderColor: '#ccc' }}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }}/>
          <Line type="monotone" dataKey="value" name={keyword} stroke={color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
          {maData && maData.length > 0 && (
            <Line 
              type="monotone" 
              dataKey="value" 
              data={maData}
              name={`${keyword} (3-pt MA)`} 
              stroke={MA_LINE_COLOR} 
              strokeWidth={1.5} 
              strokeDasharray="5 5" 
              dot={false} 
              activeDot={false}
            />
          )}
          {showReferenceLine && xAxisMaxDate && (
            <ReferenceLine
              x={xAxisMaxDate}
              stroke="#aaaaaa" 
              strokeDasharray="2 4" 
              label={{
                value: `Latest Report: ${new Date(xAxisMaxDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                position: 'top', 
                fill: '#888888',
                fontSize: 9,
                dy: -5, // Offset to prevent overlap with chart border
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;