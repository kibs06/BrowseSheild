// Switch to "production" before packaging the Chrome Web Store build.
const EXTENSION_APP_ENV = 'production';
const DEVELOPMENT_APP_BASE_URL = 'http://localhost:5173';
// Replace this with your final custom domain when it is ready.
const PRODUCTION_APP_BASE_URL = 'https://project-g7nc2.vercel.app';

function normalizeBaseUrl(url = '') {
  return String(url).trim().replace(/\/+$/, '');
}

function normalizeRoutePath(path = '/') {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function parseHostname(url = '') {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

const APP_BASE_URLS = {
  development: DEVELOPMENT_APP_BASE_URL,
  production: PRODUCTION_APP_BASE_URL,
};

export const SUPABASE_URL = 'https://lvatenreibjaupjlrojx.supabase.co';
// Browser-safe publishable key only. Do not use a service role key in the extension.
export const SUPABASE_ANON_KEY = 'sb_publishable_dgxqlFftKKznoUvdyOJgVA_QjVIXgTG';

export const APP_BASE_URL = normalizeBaseUrl(
  APP_BASE_URLS[EXTENSION_APP_ENV] ?? DEVELOPMENT_APP_BASE_URL,
);

export const APP_HOSTNAME = parseHostname(APP_BASE_URL);
export const DASHBOARD_URL = buildAppUrl('/dashboard');

export function isProductionAppUrlConfigured() {
  return !APP_BASE_URL.includes('your-vercel-domain.vercel.app');
}

export function buildAppUrl(path = '/') {
  const normalizedPath = normalizeRoutePath(path);
  return `${APP_BASE_URL}/#${normalizedPath}`;
}

export function buildThreatDetailsUrl(scanId = '') {
  return buildAppUrl(scanId ? `/threat-details/${scanId}` : '/threat-details');
}

export function getIgnoredAutoScanHosts() {
  return new Set(
    ['localhost', '127.0.0.1', APP_HOSTNAME].filter(Boolean),
  );
}
