# Pinterest Trends Visualizer

This project is a web application designed to help users explore and visualize trending topics on Pinterest. By entering keywords, users can fetch and display trend data over time, allowing for insights into what's currently popular or gaining traction on the platform. The application aims to provide a simple and intuitive interface for trend discovery and analysis.

## Key Features

- **Keyword-Based Trend Search:** Users can input single or multiple keywords to search for related Pinterest trends.
- **Data Visualization:** Fetched trend data is presented in an easy-to-understand visual format, typically a line chart, showing interest over time.
- **Mock Backend:** Includes a mock backend server that simulates responses from the Pinterest API, allowing for development and testing without needing live API keys or making actual API calls.
- **Responsive Design:** The frontend is designed to be usable across different screen sizes.
- **Settings Configuration (Potential):** Future enhancements could include options to customize date ranges, regions, or other parameters for trend data.

## How it Works

The application consists of a React frontend and a Node.js mock backend:

1.  **User Interaction (Frontend):** The user enters keywords into the React application running in their browser.
2.  **API Request (Frontend):** The frontend makes an API call to a relative path (e.g., `/api/pinterest-trends`).
3.  **Proxy (Vite):** The Vite development server, configured with a proxy, intercepts this request.
4.  **Request Forwarding (Vite to Backend):** Vite forwards the request to the mock backend server running on `http://localhost:3001` (or the configured target).
5.  **Mock API Response (Backend):** The Node.js/Express backend simulates a response from the Pinterest API, providing sample trend data based on the keywords.
6.  **Response to Frontend (Backend to Vite to Frontend):** The mock data is sent back through the Vite proxy to the frontend application.
7.  **Data Display (Frontend):** The React application receives the data and visualizes it, typically as a chart.

This setup allows for frontend development and testing without requiring actual Pinterest API credentials or making live API calls, using the mock backend to provide predictable data.

## Data Analysis and Insights (Gemini AI)

Beyond basic trend visualization, the application incorporates a sophisticated analytics layer powered by Google's Gemini AI and local data processing:

1.  **Data Ingestion & Parsing (`csvParser.ts`):**
    *   The application can process CSV files containing Pinterest trend data.
    *   The <mcsymbol name="parseAndAggregateCsvData" filename="csvParser.ts" path="/Users/salim/Downloads/pinterest-trends-visualizer (1)/services/csvParser.ts" startline="28" type="function"></mcsymbol> function in <mcfile name="csvParser.ts" path="/Users/salim/Downloads/pinterest-trends-visualizer (1)/services/csvParser.ts"></mcfile> is responsible for:
        *   Reading multiple CSV files.
        *   Identifying header rows and date columns dynamically.
        *   Extracting keyword trend data (rank, weekly/monthly/yearly changes, and time-series values).
        *   Aggregating data for the same keyword from different CSV reports or over time.
        *   Structuring the parsed data into a consistent format (`KeywordTrendData`) for use in the application.

2.  **AI-Powered Analysis (`geminiAPIService.ts`):**
    *   Once trend data is fetched (either from the mock backend or parsed CSVs), it can be sent to Google's Gemini AI for deeper analysis via <mcfile name="geminiAPIService.ts" path="/Users/salim/Downloads/pinterest-trends-visualizer (1)/services/geminiAPIService.ts"></mcfile>.
    *   **Basic Analysis (<mcsymbol name="getGeminiAnalysis" filename="geminiAPIService.ts" path="/Users/salim/Downloads/pinterest-trends-visualizer (1)/services/geminiAPIService.ts" startline="36" type="function"></mcsymbol>):** Takes a summary of top trends and asks the AI for market overview, strategic recommendations, key insights, and risk factors.
    *   **Advanced Analysis (<mcsymbol name="getAdvancedGeminiAnalysis" filename="geminiAPIService.ts" path="/Users/salim/Downloads/pinterest-trends-visualizer (1)/services/geminiAPIService.ts" startline="86" type="function"></mcsymbol>):** Sends more detailed statistical data (including momentum, volatility, categories, seasonal patterns) for a comprehensive business intelligence report, including predictions and category analysis.
    *   The service formats the trend data into detailed prompts for the Gemini AI model (`gemini-1.5-flash`) and then presents the AI's textual analysis back to the user.

This combination allows users not only to see the trends but also to understand their potential implications and receive actionable insights, leveraging advanced AI capabilities.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express (simulated API)

## How to Run

1.  **Backend:**
    ```bash
    cd backend
    node server.cjs
    ```
    The backend server will start on `http://localhost:3001`.

2.  **Frontend:**
    In a new terminal:
    ```bash
    npm install
    npm run dev
    ```
    The frontend development server will start, typically on `http://localhost:5173`.

## Project Structure

-   `src/`: Contains the frontend source code.
    -   `App.tsx`: Main application component.
    -   `components/`: Reusable React components.
    -   `services/`: Services for API calls, data parsing, etc.
    -   `constants.ts`: Application-wide constants.
    -   `types.ts`: TypeScript type definitions.
-   `backend/`: Contains the backend server code.
    -   `server.cjs`: The Node.js Express server that simulates the Pinterest API.
-   `public/`: Static assets.
-   `vite.config.ts`: Vite configuration file, including proxy settings for the backend API.
-   `package.json`: Project dependencies and scripts.