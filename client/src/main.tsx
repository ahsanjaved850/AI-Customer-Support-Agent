import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import { App } from '@/App';
import { BrandingProvider } from '@/branding/BrandingProvider';
import { ColorModeProvider } from '@/theme/ColorModeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <ColorModeProvider>
          <App />
        </ColorModeProvider>
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
