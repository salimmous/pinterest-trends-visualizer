const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001; 

const corsOptions = {
  origin: '*', 
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const generateBackendMockPoints = (startDateStr, numPoints, peakValue, troughValue, pattern) => {
  const points = {}; 
  let currentDate = new Date(startDateStr + 'T00:00:00Z'); 

  for (let i = 0; i < numPoints; i++) {
    let value;
    switch (pattern) {
      case 'seasonal':
        value = Math.round(troughValue + (peakValue - troughValue) * (0.5 * (1 - Math.cos((i / (numPoints / 2)) * Math.PI))));
        break;
      case 'growth':
        value = Math.round(troughValue + ((peakValue - troughValue) / (numPoints -1)) * i + (Math.random() * 10 - 5));
        break;
      case 'decline':
        value = Math.round(peakValue - ((peakValue - troughValue) / (numPoints-1)) * i + (Math.random() * 10 - 5));
        break;
      default: 
        value = Math.round( (peakValue + troughValue) / 2 + Math.random() * 8 - 4);
        break;
    }
    value = Math.max(0, Math.min(100, value));
    points[currentDate.getTime()] = value; 
    
    currentDate.setUTCDate(currentDate.getUTCDate() + 7); 
  }
  return points;
};

const fetchFromPinterestAPI = async (apiKeyFromEnv, apiKeyFromQuery, keyword) => {
  console.log(`Simulating Pinterest API call for keyword: ${keyword}`);
  if (apiKeyFromQuery) {
    console.log(`Received API Key from frontend query: *********${apiKeyFromQuery.slice(-4)} (This is for simulation; in production, key validation and use would happen here with the securely stored PINTEREST_API_KEY from env)`);
  } else {
    console.log("No API Key provided in query from frontend for this Pinterest API request simulation.");
  }
  if (apiKeyFromEnv) {
    console.log(`Conceptual backend API Key (from PINTEREST_API_KEY env var): *********${apiKeyFromEnv.slice(-4)}`);
  } else {
     console.log("PINTEREST_API_KEY environment variable is NOT set on the backend.");
  }
  
  const today = new Date();
  const startDate = new Date(today);
  startDate.setUTCMonth(today.getUTCMonth() - 4); 
  startDate.setUTCDate(1);
  const startDateStr = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startDate.getUTCDate()).padStart(2, '0')}`;

  let pointsData = {};
  let metadata = {};

  if (keyword === "API: Home Renovation") {
    pointsData = generateBackendMockPoints(startDateStr, 16, 90, 40, 'seasonal');
    metadata = { rank: 1, weeklyChange: "+10%", monthlyChange: "+40%", yearlyChange: "-5%" };
  } else if (keyword === "API: Travel Destinations") {
    pointsData = generateBackendMockPoints(startDateStr, 16, 95, 20, 'growth');
    metadata = { rank: 2, weeklyChange: "+25%", monthlyChange: "+70%", yearlyChange: "+30%" };
  } else { 
    pointsData = generateBackendMockPoints(startDateStr, 16, 60, 30, 'flat');
    metadata = { rank: 3, weeklyChange: "0%", monthlyChange: "+5%", yearlyChange: "-2%" };
  }

  return {
    points: pointsData, 
    metadata: {
        ...metadata,
        reportDate: today.toISOString(), 
        dataSource: 'api'
    }
  };
};

app.get('/api/pinterest-trends', async (req, res) => {
  const pinterestApiKeyFromEnv = process.env.PINTEREST_API_KEY;
  const apiKeyFromQuery = req.query.apiKey; // Check if frontend sent an API key

  const keywordsToFetch = ["API: Home Renovation", "API: Travel Destinations", "API: DIY Crafts"];
  const aggregatedDataForTransport = {};

  try {
    for (const kw of keywordsToFetch) {
      const apiResponse = await fetchFromPinterestAPI(pinterestApiKeyFromEnv, apiKeyFromQuery, kw); 
      
      aggregatedDataForTransport[kw] = {
        keyword: kw,
        pointsMap: apiResponse.points, 
        metadataEntries: [apiResponse.metadata] 
      };
    }
    res.json(aggregatedDataForTransport);
  } catch (error) {
    console.error("Error in backend API route:", error);
    res.status(500).json({ error: "Failed to fetch data from Pinterest API simulation" });
  }
});


app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("To use with a real Pinterest API key, set the PINTEREST_API_KEY environment variable when starting this server.");
  console.log("This backend SIMULATES API calls. Replace mock logic with actual Pinterest API integration for live data.");
});