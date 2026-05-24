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
  const [state, setState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    const code = params.get('code');
    const oauthState = params.get('state');
    const error = params.get('error');

    if (error) {
      setState({ status: 'error', message: error });
      return;
    }
    if (!code || !oauthState) {
      setState({ status: 'error', message: 'Missing authorization code' });
      return;
    }

    (async () => {
      try {
        const result = await googleApiClient.exchangeCode(code, oauthState);
        if (result.teamId) {
          markGoogleConnected(result.teamId);
        }
        await queryClient.invalidateQueries({ queryKey: ['google-status'] });
        setState({
          status: 'success',
          message: result.channelTitle
            ? `Connected to ${result.channelTitle}`
            : 'Google connected successfully',
        });
        setTimeout(() => navigate('/settings?tab=integrations'), 2000);
      } catch (err) {
        setState({ status: 'error', message: err.message || 'Connection failed' });
      }
    })();
  }, [params, navigate, queryClient]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      {state.status === 'loading' && (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Completing Google sign-in…</p>
        </>
      )}
      {state.status === 'success' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          <p className="text-foreground font-medium">{state.message}</p>
          <p className="text-sm text-muted-foreground">Redirecting to Settings…</p>
        </>
      )}
      {state.status === 'error' && (
        <>
          <XCircle className="w-12 h-12 text-destructive" />
          <p className="text-foreground font-medium">Could not connect Google</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">{state.message}</p>
          <Button onClick={() => navigate('/settings?tab=integrations')}>
            Back to Settings
          </Button>
        </>
      )}
    </div>
  );
}
