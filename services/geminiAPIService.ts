
import { GoogleGenerativeAI } from '@google/generative-ai';
import { KeywordTrendData } from '../types';

/**
 * 🤖 REAL GEMINI API SERVICE - Complete Logic Explanation
 * 
 * This service connects to Google's actual Gemini AI to analyze Pinterest trends.
 * It's like having a marketing expert analyze your data and give you insights.
 * 
 * HOW IT WORKS:
 * 1. Takes your trend data (keywords, popularity, etc.)
 * 2. Formats it into a clear question for the AI
 * 3. Sends to Google's Gemini AI servers
 * 4. AI analyzes and returns marketing insights
 * 5. We format and display the results
 */

// Interface for advanced analysis - defines what data we send to AI
interface TrendAnalysisInput {
  trends: KeywordTrendData[];     // Array of trend objects with full statistics
  timeframe: string;              // Date range of the data (e.g., "1/1/2024 - 12/31/2024")
  totalDataPoints: number;        // Total number of data points in the dataset
}

/**
 * 🔥 BASIC AI ANALYSIS FUNCTION
 * 
 * This is the "quick analysis" option that users see.
 * 
 * SIMPLE LOGIC:
 * 1. Takes top 5 trends as a simple text summary
 * 2. Asks AI: "What do these trends mean for Pinterest creators?"
 * 3. Gets back: Market insights, recommendations, risks
 * 
 * EXAMPLE INPUT: "sustainable fashion (Category: Fashion, Momentum: 15.2); eco home (Category: Home, Momentum: 12.1)"
 * EXAMPLE OUTPUT: Detailed analysis with strategic recommendations
 */
export const getGeminiAnalysis = async (
  trendSummary: string, // Simple text summary of top 5 trends
  apiKey: string       // Your Gemini API key from .env.local
): Promise<string> => {
  // Log the API call (with masked key for security)
  console.log(`🤖 Making BASIC Gemini API call with API Key: ${apiKey ? '********' + apiKey.slice(-4) : 'Not Provided'}`);
  console.log("📊 Trend summary sent for analysis:", trendSummary);

  try {
    // STEP 1: Create connection to Google's AI service
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // STEP 2: Choose the AI model (Gemini 1.5 Flash is the latest stable version)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // STEP 3: Create a detailed prompt (this is like asking a human expert)
    const prompt = `
You are an expert Pinterest trends analyst with years of experience in social media marketing.
Analyze the following trend data and provide actionable business insights:

Trend Data: ${trendSummary}

Please provide a comprehensive analysis including:
1. Market Overview - What are the key patterns and trends?
2. Strategic Recommendations - What specific actions should content creators take?
3. Key Insights - What are the most important findings for business success?
4. Risk Factors - What potential challenges or risks should be considered?

Format your response with clear headings and bullet points for easy reading.
Be specific and actionable in your recommendations.`;

    // STEP 4: Send the prompt to AI and wait for response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // STEP 5: Format the AI response and return it
    console.log("✅ Basic AI analysis completed successfully");
    return `🤖 **Real AI Trend Analysis Report**\n\n${text}`;
    
  } catch (error: any) {
    // Handle any errors (network issues, invalid API key, etc.)
    console.error('❌ Error calling Gemini API:', error);
    throw new Error(`Failed to get AI analysis: ${error.message || 'Unknown error'}`);
  }
};

/**
 * 🚀 ADVANCED AI ANALYSIS FUNCTION
 * 
 * This is the "comprehensive analysis" option for deep insights.
 * 
 * ADVANCED LOGIC:
 * 1. Takes top 20 trends with full statistical data
 * 2. Includes momentum, volatility, seasonal patterns, categories
 * 3. Asks AI: "Do a complete business intelligence analysis"
 * 4. Gets back: Statistical insights, predictions, category analysis, strategic planning
 * 
 * EXAMPLE INPUT: Full trend objects with all metrics and seasonal data
 * EXAMPLE OUTPUT: Comprehensive business intelligence report with percentages and predictions
 */
export const getAdvancedGeminiAnalysis = async (
  analysisInput: TrendAnalysisInput,  // Structured data with full trend details
  apiKey: string                      // Your Gemini API key
): Promise<string> => {
  // Log the advanced API call
  console.log(`🚀 Making ADVANCED Gemini API call with API Key: ${apiKey ? '********' + apiKey.slice(-4) : 'Not Provided'}`);
  console.log("📈 Advanced trend data sent for analysis:", analysisInput.trends.length, "trends");

  try {
    // STEP 1: Create connection to Google's AI service
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // STEP 2: Choose the AI model (same as basic, but with more complex data)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // STEP 3: Prepare detailed trend data for analysis
    // Extract only the important metrics for AI analysis
    const trendDetails = analysisInput.trends.map(trend => ({
       keyword: trend.keyword,              // The Pinterest keyword (e.g., "sustainable fashion")
       category: trend.trendCategory,       // Category (e.g., "Fashion", "Home", "Food")
       momentum: trend.recentMomentum,      // How fast it's growing (positive = growing, negative = declining)
       averageValue: trend.averageValue,    // Average popularity score
       volatility: trend.volatility,        // How much it fluctuates (higher = more unpredictable)
       seasonalIndexes: trend.seasonalIndexes // Seasonal patterns (when it peaks during the year)
     }));

    // STEP 4: Create a comprehensive prompt for advanced analysis
    const prompt = `
You are a senior Pinterest trends analyst and business intelligence expert.
Perform a comprehensive analysis of the following detailed trend dataset:

Dataset Overview:
- Timeframe: ${analysisInput.timeframe}
- Total Data Points: ${analysisInput.totalDataPoints}
- Number of Trends Analyzed: ${analysisInput.trends.length}

Detailed Trend Data:
${JSON.stringify(trendDetails, null, 2)}

Please provide a comprehensive business intelligence report including:

1. **Dataset Overview** - Summary statistics and data quality assessment
2. **Category Distribution** - Analysis of trend categories and their performance
3. **Performance Insights** - High performers vs declining trends with specific percentages
4. **Seasonal Analysis** - Seasonal patterns and optimal timing insights
5. **AI-Powered Recommendations** - Strategic recommendations based on the data
6. **Volatility Assessment** - Risk analysis and volatility patterns
7. **Predictive Insights** - Future outlook and next steps for content creators

Format your response with clear headings, bullet points, and specific data-driven insights.
Include percentages, specific examples, and actionable recommendations.`;

    // STEP 5: Send the comprehensive prompt to AI and wait for detailed response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // STEP 6: Format the advanced AI response and return it
    console.log("✅ Advanced AI analysis completed successfully");
    return `🚀 **Real Advanced AI Intelligence Report**\n\n${text}`;
    
  } catch (error: any) {
    // Handle any errors (network issues, invalid API key, quota exceeded, etc.)
    console.error('❌ Error calling Advanced Gemini API:', error);
    throw new Error(`Failed to get advanced AI analysis: ${error.message || 'Unknown error'}`);
  }
};

/**
 * 🎯 SUMMARY OF HOW THIS ALL WORKS:
 * 
 * 1. USER CLICKS BUTTON → App calls one of these functions
 * 2. DATA PREPARATION → Format trend data for AI
 * 3. API CONNECTION → Connect to Google's Gemini AI
 * 4. SEND PROMPT → Send formatted question to AI
 * 5. AI PROCESSING → Google's AI analyzes your data
 * 6. GET RESPONSE → AI returns marketing insights
 * 7. DISPLAY RESULTS → Show analysis to user
 * 
 * The AI is REAL - it actually understands your Pinterest trends and gives
 * you genuine marketing advice based on your specific data!
 * 
 * No fake responses, no pre-written text - just real AI analysis!
 */
