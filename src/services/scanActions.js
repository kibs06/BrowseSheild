import { getSupabaseClient } from '../lib/supabase';

const STORAGE_KEY = 'browseshield-demo-scan-actions';

function readLocalActions() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocalActions(items) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listScanActions(scanId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const actions = readLocalActions();
    return scanId ? actions.filter((item) => item.scanId === scanId) : actions;
  }

  let query = supabase.from('scan_actions').select('*').order('created_at', { ascending: false });
  if (scanId) {
    query = query.eq('scan_id', scanId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data.map((item) => ({
    id: item.id,
    scanId: item.scan_id,
    actionType: item.action_type,
    source: item.source ?? 'web',
    createdAt: item.created_at,
  }));
}

export async function recordScanAction({ scanId, actionType, source = 'web' }) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const current = readLocalActions();
    const record = {
      id: `action-${crypto.randomUUID()}`,
      scanId,
      actionType,
      source,
      createdAt: new Date().toISOString(),
    };
    writeLocalActions([record, ...current]);
    return record;
  }

  const { data, error } = await supabase
    .from('scan_actions')
    .insert({
      scan_id: scanId,
      action_type: actionType,
      source,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await supabase.from('scan_results').update({ user_action: actionType }).eq('id', scanId);

  return {
    id: data.id,
    scanId: data.scan_id,
    actionType: data.action_type,
    source: data.source ?? 'web',
    createdAt: data.created_at,
  };
}
