import { ThemeProvider } from '@medano-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CurrencyProvider, SessionProvider } from './lib/session';
import { ApiError } from './lib/api';
import { FaviconSync } from './theme/favicon';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: (failureCount, error) => {
        // 401/403/404: reintentar no ayuda
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

// PWA: solo en prod (en dev interfiere con HMR)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider storageKeys={{ theme: 'bv-theme', accent: 'bv-accent' }}>
        <FaviconSync />
        <SessionProvider>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
