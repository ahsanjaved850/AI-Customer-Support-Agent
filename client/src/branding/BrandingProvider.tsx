import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getConfig } from '@/api';

export const DEFAULT_COMPANY_NAME = 'AI Customer Support Agent';

interface BrandingContextValue {
  companyName: string | null;
  accentColor: string | null;
  loading: boolean;
  refresh: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

/**
 * Fetches company branding (name + accent color) from the server config —
 * the same store used for the LLM provider/key — so the app can be
 * relabeled and re-colored for any company without a code change. This is
 * server-side truth: deliberately not cached in localStorage, since the
 * fetch is fast on a local deployment and caching would add a second,
 * staleness-prone source of truth.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getConfig()
      .then((status) => {
        setCompanyName(status.companyName ?? null);
        setAccentColor(status.accentColor ?? null);
      })
      .catch(() => {
        setCompanyName(null);
        setAccentColor(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    document.title = companyName ?? DEFAULT_COMPANY_NAME;
  }, [companyName]);

  return (
    <BrandingContext.Provider value={{ companyName, accentColor, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within a BrandingProvider');
  return ctx;
}
