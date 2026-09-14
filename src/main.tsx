import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initializeLocalApplication } from './shared/utils/initialization';

// Guarantee that every browser/computer opening the app has its local default user & schema initialized
initializeLocalApplication();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
