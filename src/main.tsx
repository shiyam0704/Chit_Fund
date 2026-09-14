import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initializeAuthStorage } from './features/auth/utils/authStorage';
import { initializeLocalApplication } from './shared/utils/initialization';

// Guarantee that every browser/computer opening the app has its local default user & schema initialized
initializeAuthStorage();
initializeLocalApplication();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
