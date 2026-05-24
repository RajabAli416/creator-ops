import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Link2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Prominent Google workspace connection status for Settings, Pipeline, etc.
 */
export default function GoogleConnectionStatus({
  connected,
  configured,
  channelTitle,
  connectedAt,
  isLoading,
  isError,
  error,
  onRetry,
  compact = false,
}) {
  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-border bg-secondary/30 ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        }`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Checking Google connection…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={`rounded-lg border border-red-500/30 bg-red-500/10 ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        }`}
      >
        <div className="flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">Could not verify Google connection</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {error?.message ||
                'API request failed. Set SUPABASE_SERVICE_ROLE_KEY in Vercel, run migration 002_google_integrations.sql, and redeploy.'}
            </p>
          </div>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" className="shrink-0 h-7" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div
        className={`rounded-lg border border-emerald-500/30 bg-emerald-500/10 ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        }`}
      >
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Google connected</p>
            {channelTitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                YouTube: <span className="text-foreground">{channelTitle}</span>
              </p>
            )}
            {!compact && (
              <p className="text-xs text-muted-foreground mt-1">
                Drive folders and YouTube publishing are enabled for this workspace.
                {connectedAt ? ` Connected ${new Date(connectedAt).toLocaleDateString()}.` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/10 ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        }`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90">
            Save your Google OAuth Client ID and secret below, then click Connect Google.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border bg-secondary/30 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <div className="flex items-start gap-2">
        <Link2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Google is not connected yet. Click <strong className="text-foreground">Connect Google</strong>{' '}
          below to enable Drive and YouTube publishing.
        </p>
      </div>
    </div>
  );
}
