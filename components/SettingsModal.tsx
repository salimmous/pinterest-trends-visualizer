
import React, { useState, useEffect } from 'react';
import { 
  DEFAULT_ANALYSIS_WINDOW_MONTHS,
  DEFAULT_MA_WINDOW_POINTS,
  DEFAULT_SEASONAL_PEAK_THRESHOLD_PCT,
  DEFAULT_VOLATILITY_CV_THRESHOLD_PCT,
  DEFAULT_PINTEREST_API_KEY, // New
  DEFAULT_GEMINI_API_KEY    // New
} from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: {
    analysisWindow: number;
    maPoints: number;
    seasonalThreshold: number;
    volatilityThreshold: number;
    pinterestApiKey: string; // New
    geminiApiKey: string;    // New
  };
  onSave: (newSettings: {
    analysisWindow: number;
    maPoints: number;
    seasonalThreshold: number;
    volatilityThreshold: number;
    pinterestApiKey: string; // New
    geminiApiKey: string;    // New
  }) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentSettings, 
  onSave 
}) => {
  const [analysisWindow, setAnalysisWindow] = useState(currentSettings.analysisWindow);
  const [maPoints, setMaPoints] = useState(currentSettings.maPoints);
  const [seasonalThreshold, setSeasonalThreshold] = useState(currentSettings.seasonalThreshold);
  const [volatilityThreshold, setVolatilityThreshold] = useState(currentSettings.volatilityThreshold);
  const [pinterestKey, setPinterestKey] = useState(currentSettings.pinterestApiKey); // New
  const [geminiKey, setGeminiKey] = useState(currentSettings.geminiApiKey);       // New

  useEffect(() => {
    if (isOpen) {
      setAnalysisWindow(currentSettings.analysisWindow);
      setMaPoints(currentSettings.maPoints);
      setSeasonalThreshold(currentSettings.seasonalThreshold);
      setVolatilityThreshold(currentSettings.volatilityThreshold);
      setPinterestKey(currentSettings.pinterestApiKey); // New
      setGeminiKey(currentSettings.geminiApiKey);       // New
    }
  }, [isOpen, currentSettings]);

  const handleSave = () => {
    onSave({
      analysisWindow: Number(analysisWindow),
      maPoints: Number(maPoints),
      seasonalThreshold: Number(seasonalThreshold),
      volatilityThreshold: Number(volatilityThreshold),
      pinterestApiKey: pinterestKey, // New
      geminiApiKey: geminiKey        // New
    });
  };

  const handleResetDefaults = () => {
    setAnalysisWindow(DEFAULT_ANALYSIS_WINDOW_MONTHS);
    setMaPoints(DEFAULT_MA_WINDOW_POINTS);
    setSeasonalThreshold(DEFAULT_SEASONAL_PEAK_THRESHOLD_PCT);
    setVolatilityThreshold(DEFAULT_VOLATILITY_CV_THRESHOLD_PCT);
    setPinterestKey(DEFAULT_PINTEREST_API_KEY); // New
    setGeminiKey(DEFAULT_GEMINI_API_KEY);       // New
  };

  if (!isOpen) return null;

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none";
  const labelClass = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Application Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <h3 className="text-lg font-semibold text-pink-600 border-b border-pink-200 pb-2 mb-3">Analytical Settings</h3>
          <div>
            <label htmlFor="analysisWindow" className={labelClass}>Analysis Window (months):</label>
            <input 
              type="number" 
              id="analysisWindow" 
              min="6" max="60" 
              value={analysisWindow} 
              onChange={(e) => setAnalysisWindow(Number(e.target.value))} 
              className={inputClass} 
            />
          </div>
          <div>
            <label htmlFor="maPoints" className={labelClass}>Moving Average Points:</label>
            <input 
              type="number" 
              id="maPoints" 
              min="2" max="10" 
              value={maPoints} 
              onChange={(e) => setMaPoints(Number(e.target.value))} 
              className={inputClass} 
            />
          </div>
          <div>
            <label htmlFor="seasonalThreshold" className={labelClass}>Seasonal Peak Threshold (% above avg):</label>
            <input 
              type="number" 
              id="seasonalThreshold" 
              min="5" max="100" 
              value={seasonalThreshold} 
              onChange={(e) => setSeasonalThreshold(Number(e.target.value))} 
              className={inputClass} 
            />
            <p className="text-xs text-slate-500 mt-1">e.g., 25 means an index of 125% is considered a peak.</p>
          </div>
          <div>
            <label htmlFor="volatilityThreshold" className={labelClass}>Volatility CV Threshold (% for 'Volatile' category):</label>
            <input 
              type="number" 
              id="volatilityThreshold" 
              min="10" max="100" 
              value={volatilityThreshold} 
              onChange={(e) => setVolatilityThreshold(Number(e.target.value))} 
              className={inputClass} 
            />
          </div>
          
          <h3 className="text-lg font-semibold text-pink-600 border-b border-pink-200 pb-2 mb-3 pt-4">API Key Configuration (Simulated)</h3>
           <p className="text-xs text-slate-500 mb-2 italic">Note: For security, API keys are typically handled server-side. These inputs are for demonstration and simulation purposes within this frontend application.</p>
          <div>
            <label htmlFor="pinterestApiKey" className={labelClass}>Pinterest API Key:</label>
            <input 
              type="text" 
              id="pinterestApiKey" 
              value={pinterestKey} 
              placeholder="Enter your Pinterest API Key"
              onChange={(e) => setPinterestKey(e.target.value)} 
              className={inputClass} 
            />
          </div>
          <div>
            <label htmlFor="geminiApiKey" className={labelClass}>Google Gemini API Key:</label>
            <input 
              type="text" 
              id="geminiApiKey" 
              value={geminiKey} 
              placeholder="Enter your Google Gemini API Key"
              onChange={(e) => setGeminiKey(e.target.value)} 
              className={inputClass} 
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row-reverse gap-3">
          <button
            onClick={handleSave}
            className="w-full sm:w-auto py-2.5 px-5 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
          >
             <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            Save & Apply Settings
          </button>
          <button
            onClick={handleResetDefaults}
            className="w-full sm:w-auto py-2.5 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors flex items-center justify-center"
          >
            <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Reset to Defaults
          </button>
           <button
            onClick={onClose}
            className="w-full sm:w-auto mt-2 sm:mt-0 py-2.5 px-5 bg-transparent hover:bg-slate-100 text-slate-600 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
