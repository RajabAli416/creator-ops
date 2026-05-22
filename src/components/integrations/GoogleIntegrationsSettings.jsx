import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link2, Unplug, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  googleApiClient,
  saveGoogleOAuthConfig,
  getGoogleOAuthConfig,
} from '@/api/google';
import { GOOGLE_CLOUD_SETUP_STEPS, getRedirectUriHint } from '@/lib/google/setupGuide';

export default function GoogleIntegrationsSettings({ teamId }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const redirectUri = getRedirectUriHint();

  const { data: savedConfig } = useQuery({
    queryKey: ['google-config', teamId],
    queryFn: () => getGoogleOAuthConfig(teamId),
    enabled: !!teamId,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['google-status', teamId],
    queryFn: () => googleApiClient.getStatus(teamId),
    enabled: !!teamId,
  });

  useEffect(() => {
    if (savedConfig?.client_id) setClientId(savedConfig.client_id);
  }, [savedConfig?.client_id]);

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Client ID and secret are required');
      return;
    }
    setSaving(true);
    try {
      await saveGoogleOAuthConfig(teamId, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
      setClientSecret('');
      queryClient.invalidateQueries({ queryKey: ['google-config', teamId] });
      queryClient.invalidateQueries({ queryKey: ['google-status', teamId] });
      toast.success('Google OAuth credentials saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await googleApiClient.getOAuthUrl(teamId);
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || 'Could not start Google sign-in');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google for this workspace? YouTube and Drive actions will stop working.')) {
      return;
    }
    try {
      await googleApiClient.disconnect(teamId);
      queryClient.invalidateQueries({ queryKey: ['google-status', teamId] });
      toast.success('Google disconnected');
    } catch (err) {
      toast.error(err.message || 'Disconnect failed');
    }
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    toast.success('Redirect URI copied');
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Google (YouTube + Drive)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Use your own Google Cloud project. The workspace owner connects once; then you can upload to
              YouTube and share Drive folders from content pages.
            </p>
          </div>
          {!statusLoading && status?.connected && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </span>
          )}
        </div>

        {status?.connected && status.channelTitle && (
          <p className="text-sm text-muted-foreground">
            YouTube channel: <span className="text-foreground">{status.channelTitle}</span>
          </p>
        )}

        <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Setup in Google Cloud Console
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            {GOOGLE_CLOUD_SETUP_STEPS.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
          >
            Open Google Cloud Console <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div>
          <Label>Authorized redirect URI</Label>
          <p className="text-xs text-muted-foreground mb-1">Add this exact URI to your OAuth web client</p>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={redirectUri} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyRedirect}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>OAuth Client ID</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label>OAuth Client secret</Label>
            <Input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={savedConfig?.client_id ? '•••••••• (saved — enter to replace)' : ''}
              className="mt-1 font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSaveCredentials} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save credentials
          </Button>
          <Button
            variant="default"
            onClick={handleConnect}
            disabled={connecting || !status?.configured}
          >
            {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Connect Google
          </Button>
          {status?.connected && (
            <Button variant="outline" onClick={handleDisconnect}>
              <Unplug className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
