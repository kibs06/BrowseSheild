import { getSupabaseClient } from '../lib/supabase';

const STORAGE_KEY = 'browseshield-demo-scan-feedback';

function readLocalFeedback() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocalFeedback(items) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listScanFeedback(scanId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const feedback = readLocalFeedback();
    return scanId ? feedback.filter((item) => item.scanId === scanId) : feedback;
  }

  let query = supabase.from('scan_feedback').select('*').order('created_at', { ascending: false });
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
    feedbackType: item.feedback_type,
    note: item.note ?? '',
    createdAt: item.created_at,
  }));
}

export async function recordScanFeedback({ scanId, feedbackType, note = '' }) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const current = readLocalFeedback();
    const record = {
      id: `feedback-${crypto.randomUUID()}`,
      scanId,
      feedbackType,
      note,
      createdAt: new Date().toISOString(),
    };
    writeLocalFeedback([record, ...current]);
    return record;
  }

  const { data, error } = await supabase
    .from('scan_feedback')
    .insert({
      scan_id: scanId,
      feedback_type: feedbackType,
      note,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    scanId: data.scan_id,
    feedbackType: data.feedback_type,
    note: data.note ?? '',
    createdAt: data.created_at,
  };
}
