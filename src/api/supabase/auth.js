import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { mapUser } from '@/api/mappers';

export function formatAuthError(error) {
  if (!error) return 'Something went wrong';
  if (typeof error === 'string') return error;
  return error.message || error.error_description || 'Something went wrong';
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('fetchProfile:', error.message);
    return null;
  }
  return data;
}

function displayNameFromUser(user) {
  const meta = user.user_metadata || {};
  return (
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    user.email?.split('@')[0] ||
    'User'
  );
}

async function ensureProfile(user) {
  let profile = await fetchProfile(user.id);
  if (profile) return profile;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: displayNameFromUser(user),
    })
    .select()
    .single();

  if (error) {
    console.warn('ensureProfile upsert:', error.message);
    return null;
  }
  return data;
}

function userFromSession(sessionUser, profile) {
  return mapUser(sessionUser, profile);
}

export const supabaseAuth = {
  async me() {
    assertSupabaseConfigured();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    const user = session?.user;
    if (!user) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    const profile = await ensureProfile(user);
    return userFromSession(user, profile);
  },

  async signUp({ email, password, full_name }) {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: full_name.trim() },
      },
    });
    if (error) throw error;
    if (!data.user) {
      throw new Error('Sign up failed. Please try again.');
    }

    await ensureProfile(data.user);

    if (!data.session) {
      const err = new Error(
        'Account created. Check your email to confirm, then sign in. (Or disable email confirmation in Supabase → Authentication → Providers → Email.)'
      );
      err.code = 'email_confirmation_required';
      throw err;
    }

    return userFromSession(data.user, await fetchProfile(data.user.id));
  },

  async signInWithGoogle() {
    assertSupabaseConfigured();
    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'online',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
  },

  async login({ email, password }) {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    const profile = await ensureProfile(data.user);
    return userFromSession(data.user, profile);
  },

  logout(redirectUrl) {
    supabase.auth.signOut().finally(() => {
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.reload();
      }
    });
  },

  redirectToLogin() {
    window.location.href = '/login';
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  userFromSession,
};
