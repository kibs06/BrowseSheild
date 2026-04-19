function normalizeBaseUrl(url = '') {
  return String(url).trim().replace(/\/+$/, '');
}

function normalizeRoutePath(path = '/') {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export const appConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  appBaseUrl: normalizeBaseUrl(import.meta.env.VITE_APP_BASE_URL ?? browserOrigin),
};

export function isSupabaseConfigured() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}

export function isAppBaseUrlConfigured() {
  return Boolean(appConfig.appBaseUrl);
}

export function buildAppUrl(path = '/') {
  const normalizedPath = normalizeRoutePath(path);
  return `${appConfig.appBaseUrl}/#${normalizedPath}`;
}

export function buildThreatDetailsUrl(scanId = '') {
  return buildAppUrl(scanId ? `/threat-details/${scanId}` : '/threat-details');
}
