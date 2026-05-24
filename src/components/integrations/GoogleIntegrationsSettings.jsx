import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link2, Unplug, Copy, Loader2 } from 'lucide-react';
import GoogleConnectionStatus from '@/components/integrations/GoogleConnectionStatus';
import { useGoogleConnection, clearGoogleConnectedMark } from '@/hooks/useGoogleConnection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [savingPublish, setSavingPublish] = useState(false);
  const [defaultPrivacy, setDefaultPrivacy] = useState('private');
  const [autoCreateDriveFolder, setAutoCreateDriveFolder] = useState(true);

  const redirectUri = getRedirectUriHint();

  const { data: savedConfig } = useQuery({
    queryKey: ['google-config', teamId],
    queryFn: () => getGoogleOAuthConfig(teamId),
    enabled: !!teamId,
  });

  const {
    data: status,
    connected,
    configured,
    channelTitle,
    connectedAt,
    isLoading: statusLoading,
    isError: statusError,
    error: statusErrorDetail,
    refetch: refetchStatus,
    serverConfigured,
  } = useGoogleConnection(teamId);

  useEffect(() => {
    if (savedConfig?.client_id) setClientId(savedConfig.client_id);
  }, [savedConfig?.client_id]);

  useEffect(() => {
    if (status?.publishing) {
      setDefaultPrivacy(status.publishing.defaultPrivacy || 'private');
      setAutoCreateDriveFolder(status.publishing.autoCreateDriveFolder !== false);
    }
  }, [status?.publishing]);

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
      clearGoogleConnectedMark(teamId);
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

  const handleSavePublishing = async () => {
    setSavingPublish(true);
    try {
      await googleApiClient.savePublishingSettings(teamId, {
        defaultPrivacy,
        autoCreateDriveFolder,
      });
      queryClient.invalidateQueries({ queryKey: ['google-status', teamId] });
      toast.success('Publishing defaults saved');
    } catch (err) {
      toast.error(err.message || 'Could not save publishing settings');
    } finally {
      setSavingPublish(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Google (YouTube + Drive)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect once per workspace. The pipeline scans Drive for final videos; owners and managers publish
            to YouTube in one click from the board.
          </p>
        </div>

        <GoogleConnectionStatus
          connected={connected}
          configured={configured}
          channelTitle={channelTitle}
          connectedAt={connectedAt}
          isLoading={statusLoading}
          isError={statusError}
          error={statusErrorDetail}
          onRetry={() => refetchStatus()}
          serverConfigured={serverConfigured}
        />

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
          <p className="text-xs text-muted-foreground mb-1">
            In Google Cloud → Credentials → your OAuth client → <strong>Authorized redirect URIs</strong>, add
            this exact value (must match the URL in your browser bar, including https).
          </p>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={redirectUri} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyRedirect}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          {status?.serverFallbackRedirectUri &&
            status.serverFallbackRedirectUri !== redirectUri && (
              <p className="text-xs text-amber-400 mt-2">
                Vercel <code className="text-[10px]">APP_URL</code> is set to{' '}
                <span className="font-mono">{status.serverFallbackRedirectUri}</span> but you are on{' '}
                <span className="font-mono">{redirectUri}</span>. OAuth will use your current URL — add{' '}
                <span className="font-mono">{redirectUri}</span> in Google Console (not only the APP_URL host).
              </p>
            )}
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

        {connected && (
          <div className="rounded-lg border border-border p-4 space-y-4">
            <p className="text-sm font-medium">Automated publishing</p>
            <p className="text-xs text-muted-foreground">
              Name exports final.mp4 in each card&apos;s Drive folder. The pipeline checks Drive every ~90s and
              shows &quot;Ready to publish&quot; on cards.
            </p>
            <div>
              <Label className="text-xs">Default YouTube visibility</Label>
              <Select value={defaultPrivacy} onValueChange={setDefaultPrivacy}>
                <SelectTrigger className="mt-1 h-9 max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm">Auto-create Drive folder</p>
                <p className="text-xs text-muted-foreground">
                  When a card reaches Editing, create its assets folder automatically
                </p>
              </div>
              <Switch checked={autoCreateDriveFolder} onCheckedChange={setAutoCreateDriveFolder} />
            </label>
            <Button variant="outline" size="sm" onClick={handleSavePublishing} disabled={savingPublish}>
              {savingPublish ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save publishing defaults
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSaveCredentials} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save credentials
          </Button>
          <Button
            variant="default"
            onClick={handleConnect}
            disabled={connecting || !configured}
          >
            {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Connect Google
          </Button>
          {connected && (
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
