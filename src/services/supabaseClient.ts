/**
 * Supabase Client Initialization and Configuration
 * Supports environment variables or runtime browser configuration for research deployments.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'pa_andam_supabase_url';
const STORAGE_KEY_KEY = 'pa_andam_supabase_anon_key';

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : '';

  return {
    url: storedUrl || envUrl || '',
    anonKey: storedKey || envKey || '',
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (anonKey) localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    else localStorage.removeItem(STORAGE_KEY_KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabase(): { client: SupabaseClient | null; isConfigured: boolean } {
  const { url, anonKey } = getStoredSupabaseConfig();

  if (!url || !anonKey) {
    return { client: null, isConfigured: false };
  }

  if (cachedClient && lastUsedUrl === url && lastUsedKey === anonKey) {
    return { client: cachedClient, isConfigured: true };
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastUsedUrl = url;
    lastUsedKey = anonKey;
    return { client: cachedClient, isConfigured: true };
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return { client: null, isConfigured: false };
  }
}
