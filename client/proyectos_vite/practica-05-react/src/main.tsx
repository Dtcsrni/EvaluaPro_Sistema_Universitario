import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from '.App/App.tsx';
import login from '.App/login.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
