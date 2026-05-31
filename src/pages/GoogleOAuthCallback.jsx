import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { googleApiClient } from '@/api/google';
import { markGoogleConnected } from '@/hooks/useGoogleConnection';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PENDING_OAUTH_KEY = 'creator_ops_google_oauth_pending';

function stashPendingOAuth(code, state) {
  try {
    sessionStorage.setItem(
      PENDING_OAUTH_KEY,
      JSON.stringify({ code, state, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function readPendingOAuth() {
  try {
    const raw = sessionStorage.getItem(PENDING_OAUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at > 15 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_OAUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingOAuth() {
  try {
    sessionStorage.removeItem(PENDING_OAUTH_KEY);
  } catch {
    /* ignore */
  }
}

export default function GoogleOAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [ui, setUi] = useState({ status: 'loading', message: '', detail: '' });
  const exchangeStarted = useRef(false);

  // Capture code from URL immediately (before any redirect strips it)
  useEffect(() => {
    const code = params.get('code');
    const oauthState = params.get('state');
    const error = params.get('error');

    if (error) {
      setUi({ status: 'error', message: error, detail: '' });
      return;
    }
    if (code && oauthState) {
      stashPendingOAuth(code, oauthState);
    }
  }, [params]);

  useEffect(() => {
    const error = params.get('error');
    if (error) return;

    if (isLoadingAuth) {
      setUi({ status: 'loading', message: 'Restoring your session…', detail: '' });
      return;
    }

    if (!isAuthenticated) {
      const pending = readPendingOAuth();
      setUi({
        status: 'error',
        message: 'You must be signed in to finish connecting Google.',
        detail: pending
          ? 'Sign in with the same account, then open Settings → Integrations and click Connect Google again.'
          : 'Open Settings → Integrations and click Connect Google.',
      });
      return;
    }

    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    const pending = readPendingOAuth();
    const code = pending?.code || params.get('code');
    const oauthState = pending?.state || params.get('state');

    if (!code || !oauthState) {
      setUi({
        status: 'error',
        message: 'Missing authorization data.',
        detail: 'Start again from Settings → Integrations → Connect Google.',
      });
      return;
    }

    (async () => {
      setUi({ status: 'loading', message: 'Saving Google connection…', detail: '' });
      try {
        const result = await googleApiClient.exchangeCode(code, oauthState);
        clearPendingOAuth();

        const teamId = result.teamId;
        if (teamId) markGoogleConnected(teamId);

        const status = teamId ? await googleApiClient.getStatus(teamId) : null;
        if (!status?.connected) {
          const hint = !status?.serverConfigured?.hasServiceRoleKey
            ? 'SUPABASE_SERVICE_ROLE_KEY is missing on Vercel.'
            : 'Run supabase/migrations/005_integrations_fix_columns.sql in Supabase SQL Editor.';
          throw new Error(`Tokens were not stored. ${hint}`);
        }

        await queryClient.invalidateQueries({ queryKey: ['google-status'] });

        setUi({
          status: 'success',
          message: result.channelTitle
            ? `Connected to ${result.channelTitle}`
            : 'Google connected successfully',
          detail: '',
        });
        setTimeout(() => navigate('/settings?tab=integrations', { replace: true }), 2000);
      } catch (err) {
        setUi({
          status: 'error',
          message: err.message || 'Connection failed',
          detail: '',
        });
      }
    })();
  }, [isLoadingAuth, isAuthenticated, params, navigate, queryClient]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 max-w-lg mx-auto text-center bg-[hsl(222,47%,6%)]">
      {ui.status === 'loading' && (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{ui.message || 'Completing Google sign-in…'}</p>
        </>
      )}
      {ui.status === 'success' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          <p className="text-foreground font-medium">{ui.message}</p>
          <p className="text-sm text-muted-foreground">Redirecting to Settings…</p>
        </>
      )}
      {ui.status === 'error' && (
        <>
          <XCircle className="w-12 h-12 text-destructive" />
          <p className="text-foreground font-medium">Could not connect Google</p>
          <p className="text-sm text-muted-foreground">{ui.message}</p>
          {ui.detail && <p className="text-xs text-muted-foreground mt-2">{ui.detail}</p>}
          <Button onClick={() => navigate('/settings?tab=integrations', { replace: true })}>
            Back to Settings
          </Button>
        </>
      )}
    </div>
  );
}
