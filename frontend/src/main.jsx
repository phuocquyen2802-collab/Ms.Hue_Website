import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PreferencesProvider } from './context/PreferencesContext.jsx';
import './index.css';
import 'katex/dist/katex.min.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreferencesProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PreferencesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
