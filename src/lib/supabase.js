import { createClient } from '@supabase/supabase-js';
import { appConfig, isSupabaseConfigured } from './config';

let supabaseClient = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}
