# Pinterest Trends Visualizer

This application allows users to visualize Pinterest trends. Users can input keywords, and the application will fetch and display trend data, potentially in a chart format.

## Features

- Fetch Pinterest trends data based on user-provided keywords.
- Visualize the fetched trend data.
- (Potentially) Allow users to configure settings for data fetching and visualization.

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