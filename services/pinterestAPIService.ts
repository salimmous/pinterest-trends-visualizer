
import { AggregatedData, AggregatedDataForTransport, AggregatedDataEntryForTransport } from '../types';

// This function will now fetch data from your conceptual backend
export const fetchTrendsFromBackend = async (backendUrl: string): Promise<AggregatedData> => {
  try {
    const response = await fetch(backendUrl); // Calls your backend using the provided URL
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Network response was not ok: ${response.status} ${errorText}`);
    }
    const dataForTransport: AggregatedDataForTransport = await response.json();

    // Reconstitute the data: convert pointsMap back to Map and reportDate strings to Date objects
    const reconstitutedAggregatedData: AggregatedData = {};
    for (const keyword in dataForTransport) {
      const entryForTransport: AggregatedDataEntryForTransport = dataForTransport[keyword];
      const pointsMap = new Map<number, number>();
      // Convert pointsMap from object back to Map
      for (const timestampStr in entryForTransport.pointsMap) {
          const timestamp = parseInt(timestampStr, 10);
          pointsMap.set(timestamp, entryForTransport.pointsMap[timestamp]);
      }
      
      reconstitutedAggregatedData[keyword] = {
        keyword: entryForTransport.keyword,
        pointsMap: pointsMap,
        metadataEntries: entryForTransport.metadataEntries.map(metaEntry => ({
          ...metaEntry,
          reportDate: new Date(metaEntry.reportDate), // Convert ISO string to Date
        })),
      };
    }
    return reconstitutedAggregatedData;

  } catch (error) {
    console.error("Failed to fetch trends from backend:", error);
    throw error; // Re-throw to be caught by the caller in App.tsx
  }
};