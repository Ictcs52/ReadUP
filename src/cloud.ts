import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cloudPayload, validateCloudConfig } from './cloudDomain.mjs';
import type { Session } from './types';

export type CloudConfig = { url: string; publishableKey: string };
export type Teacher = { id: string; display_name: string; active: boolean };
export type Student = { id: string; teacher_id: string; code: string; display_name: string; created_at: string };
export type CloudRow = { id: string; revision: number; payload: Session };
const configKey = 'readtech-cloud-config';

export async function readCloudConfig(): Promise<CloudConfig | null> {
  const env = { url: import.meta.env.VITE_SUPABASE_URL, publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  if (env.url && env.publishableKey) return validateCloudConfig(env.url, env.publishableKey);
  let deployed: Partial<CloudConfig> | null = null;
  try { const response = await fetch(import.meta.env.BASE_URL + 'cloud-config.json', { cache: 'no-store' }); if (response.ok) deployed = await response.json(); } catch { /* A saved configuration remains usable if the static file is unavailable. */ }
  if (deployed?.url && deployed.publishableKey) {
    const config = validateCloudConfig(deployed.url, deployed.publishableKey);
    try { localStorage.setItem(configKey, JSON.stringify(config)); } catch { /* Storage restrictions must not prevent online login. */ }
    return config;
  }
  const saved = localStorage.getItem(configKey);
  if (!saved) return null;
  const config = JSON.parse(saved);
  return validateCloudConfig(config.url, config.publishableKey);
}

export function saveCloudConfig(url: string, key: string): CloudConfig {
  const config = validateCloudConfig(url, key);
  localStorage.setItem(configKey, JSON.stringify(config));
  return config;
}

export function cloudClient(config: CloudConfig) {
  return createClient(config.url, config.publishableKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export async function fetchSessions(client: SupabaseClient, studentId: string): Promise<CloudRow[]> {
  const rows: CloudRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('readtech_sessions').select('id,revision,payload').eq('student_id', studentId).order('started_at').order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data as CloudRow[]));
    if (data.length < 1000) break;
  }
  return rows;
}

export async function writeSession(client: SupabaseClient, studentId: string, session: Session) {
  const { data, error } = await client.rpc('readtech_save_session', {
    p_student_id: studentId, p_payload: cloudPayload(session), p_expected_revision: session.cloudRevision ?? 0,
  });
  if (error) throw error;
  return data as { id: string; revision: number };
}
