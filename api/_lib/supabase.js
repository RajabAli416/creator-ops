import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl, getServiceRoleKey } from './env.js';

export function getAdminClient() {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function getAnonClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });
}

export async function getUserFromBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const client = getAnonClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function assertTeamOwner(userId, teamId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role === 'owner';
}

export async function assertTeamMember(userId, teamId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
