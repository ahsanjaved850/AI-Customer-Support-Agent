import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getConfig, setCurrentCompanySlug } from '@/api';

export const DEFAULT_COMPANY_NAME = 'AI Customer Support Agent';

interface BrandingContextValue {
  companyName: string | null;
  accentColor: string | null;
  loading: boolean;
  notFound: boolean;
  refresh: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

const SLUG_PATTERN = /^\/(?:c|admin)\/([^/]+)/;

/**
 * Fetches company branding (name + accent color) from the server config —
 * the same store used for the LLM provider/key — so the app can be
 * relabeled and re-colored for any company without a code change. This is
 * server-side truth: deliberately not cached in localStorage, since the
 * fetch is fast on a local deployment and caching would add a second,
 * staleness-prone source of truth.
 *
 * Also the single place that derives the current company slug from the URL
 * (/c/:slug or /admin/:slug) and syncs it into api.ts via
 * setCurrentCompanySlug — done during render (not inside an effect) so it's
 * guaranteed to be set before any child component's effect fires, since
 * React completes the full render pass before any effects run.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const slug = useMemo(() => {
    const match = location.pathname.match(SLUG_PATTERN);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  setCurrentCompanySlug(slug);

  const [companyName, setCompanyName] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(() => {
    if (!slug) {
      setCompanyName(null);
      setAccentColor(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    getConfig()
      .then((status) => {
        setCompanyName(status.companyName ?? null);
        setAccentColor(status.accentColor ?? null);
        setNotFound(false);
      })
      .catch((err) => {
        setCompanyName(null);
        setAccentColor(null);
        setNotFound(err?.status === 404);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    document.title = companyName ?? DEFAULT_COMPANY_NAME;
  }, [companyName]);

  return (
    <BrandingContext.Provider value={{ companyName, accentColor, loading, notFound, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within a BrandingProvider');
  return ctx;
}
