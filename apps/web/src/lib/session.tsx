import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DisplayCurrency, UserDTO } from '@bv/shared';
import { useState } from 'react';
import { api, ApiError } from './api';

interface SessionCtx {
  user: UserDTO | null;
  loading: boolean;
  refresh: () => void;
}

const SessionContext = createContext<SessionCtx>({ user: null, loading: true, refresh: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api.get<UserDTO>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return (
    <SessionContext.Provider
      value={{
        user: data ?? null,
        loading: isLoading,
        refresh: () => void qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

// ---------------------------------------------------------------- moneda de visualización

interface CurrencyCtx {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
}

const CurrencyContext = createContext<CurrencyCtx>({ currency: 'ARS', setCurrency: () => {} });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Elección explícita del usuario (localStorage); si no hay, default de Ajustes
  const [chosen, setChosen] = useState<DisplayCurrency | null>(() => {
    const saved = localStorage.getItem('bv-display-currency');
    return saved === 'USD' || saved === 'ARS' ? saved : null;
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ defaultDisplayCurrency: DisplayCurrency }>('/settings'),
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: chosen === null,
  });

  const currency: DisplayCurrency = chosen ?? settings?.defaultDisplayCurrency ?? 'ARS';

  const setCurrency = (c: DisplayCurrency) => {
    localStorage.setItem('bv-display-currency', c);
    setChosen(c);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  return useContext(CurrencyContext);
}
