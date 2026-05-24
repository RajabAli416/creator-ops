import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { googleApiClient } from '@/api/google';
import { markGoogleConnected } from '@/hooks/useGoogleConnection';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GoogleOAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', message: '', detail: '' });

  useEffect(() => {
    const code = params.get('code');
    const oauthState = params.get('state');
    const error = params.get('error');

    if (error) {
      setState({ status: 'error', message: error, detail: '' });
      return;
    }
    if (!code || !oauthState) {
      setState({ status: 'error', message: 'Missing authorization code', detail: '' });
      return;
    }

    (async () => {
      try {
        const result = await googleApiClient.exchangeCode(code, oauthState);
        const teamId = result.teamId;
        if (teamId) markGoogleConnected(teamId);

        const status = teamId ? await googleApiClient.getStatus(teamId) : null;
        if (!status?.connected) {
          throw new Error(
            'Google authorized your account, but this workspace still shows as disconnected. ' +
              'Set SUPABASE_SERVICE_ROLE_KEY in Vercel (Settings → Environment Variables), run migration ' +
              '002_google_integrations.sql in Supabase, then connect again.'
          );
        }

        await queryClient.invalidateQueries({ queryKey: ['google-status'] });

        setState({
          status: 'success',
          message: result.channelTitle
            ? `Connected to ${result.channelTitle}`
            : 'Google connected successfully',
          detail: teamId ? `Workspace linked (${teamId.slice(0, 8)}…)` : '',
        });
        setTimeout(() => navigate('/settings?tab=integrations'), 2500);
      } catch (err) {
        setState({
          status: 'error',
          message: err.message || 'Connection failed',
          detail: '',
        });
      }
    })();
  }, [params, navigate, queryClient]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 max-w-lg mx-auto text-center">
      {state.status === 'loading' && (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Saving Google connection…</p>
        </>
      )}
      {state.status === 'success' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          <p className="text-foreground font-medium">{state.message}</p>
          {state.detail && (
            <p className="text-xs text-muted-foreground">{state.detail}</p>
          )}
          <p className="text-sm text-muted-foreground">Redirecting to Settings…</p>
        </>
      )}
      {state.status === 'error' && (
        <>
          <XCircle className="w-12 h-12 text-destructive" />
          <p className="text-foreground font-medium">Could not connect Google</p>
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Button onClick={() => navigate('/settings?tab=integrations')}>
            Back to Settings
          </Button>
        </>
      )}
    </div>
  );
}
