import { getSupabaseClient } from '../lib/supabase';

const STORAGE_KEY = 'browseshield-demo-trusted-sites';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readLocalTrustedSites() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocalTrustedSites(items) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function extractDomainFromUrl(url = '') {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export async function listTrustedSites() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return clone(readLocalTrustedSites());
  }

  const { data, error } = await supabase
    .from('trusted_sites')
    .select('*')
    .order('added_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((item) => ({
    id: item.id,
    domain: item.domain,
    reason: item.reason ?? 'Trusted by user',
    source: item.source ?? 'web',
    notes: item.notes ?? '',
    addedAt: item.added_at,
  }));
}

export async function getTrustedSite(domainOrUrl) {
  const domain = domainOrUrl.includes('://') ? extractDomainFromUrl(domainOrUrl) : domainOrUrl;
  const supabase = getSupabaseClient();

  if (!supabase) {
    return readLocalTrustedSites().find((item) => item.domain === domain) ?? null;
  }

  const { data, error } = await supabase
    .from('trusted_sites')
    .select('*')
    .eq('domain', domain)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? {
        id: data.id,
        domain: data.domain,
        reason: data.reason ?? 'Trusted by user',
        source: data.source ?? 'web',
        notes: data.notes ?? '',
        addedAt: data.added_at,
      }
    : null;
}

export async function addTrustedSite({ domain, reason = 'Trusted by user', source = 'web', notes = '' }) {
  const supabase = getSupabaseClient();
  const normalizedDomain = extractDomainFromUrl(domain) || domain.toLowerCase();

  if (!supabase) {
    const current = readLocalTrustedSites();
    const existing = current.find((item) => item.domain === normalizedDomain);
    if (existing) {
      return clone(existing);
    }

    const record = {
      id: `trusted-${crypto.randomUUID()}`,
      domain: normalizedDomain,
      reason,
      source,
      notes,
      addedAt: new Date().toISOString(),
    };
    writeLocalTrustedSites([record, ...current]);
    return clone(record);
  }

  const { data, error } = await supabase
    .from('trusted_sites')
    .upsert(
      {
        domain: normalizedDomain,
        reason,
        source,
        notes,
      },
      { onConflict: 'domain' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    domain: data.domain,
    reason: data.reason ?? 'Trusted by user',
    source: data.source ?? 'web',
    notes: data.notes ?? '',
    addedAt: data.added_at,
  };
}
