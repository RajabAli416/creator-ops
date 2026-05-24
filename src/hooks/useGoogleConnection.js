import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { googleApiClient } from '@/api/google';

const RECENT_CONNECT_MS = 10 * 60 * 1000;

function storageKey(teamId) {
  return `google_connected_${teamId}`;
}

export function markGoogleConnected(teamId) {
  if (!teamId) return;
  try {
    sessionStorage.setItem(storageKey(teamId), String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function clearGoogleConnectedMark(teamId) {
  if (!teamId) return;
  try {
    sessionStorage.removeItem(storageKey(teamId));
  } catch {
    /* ignore */
  }
}

function wasRecentlyMarkedConnected(teamId) {
  if (!teamId) return false;
  try {
    const raw = sessionStorage.getItem(storageKey(teamId));
    if (!raw) return false;
    return Date.now() - Number(raw) < RECENT_CONNECT_MS;
  } catch {
    return false;
  }
}

/**
 * Workspace Google (YouTube + Drive) connection status from API.
 */
export function useGoogleConnection(teamId) {
  const query = useQuery({
    queryKey: ['google-status', teamId],
    queryFn: () => googleApiClient.getStatus(teamId),
    enabled: !!teamId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const apiConnected =
    !!query.data?.connected || !!query.data?.hasTokens || !!query.data?.integrationRow;
  const optimistic = wasRecentlyMarkedConnected(teamId);
  const connected = apiConnected || (optimistic && !query.isError);
  const configured = !!query.data?.configured;

  useEffect(() => {
    if (apiConnected && teamId) clearGoogleConnectedMark(teamId);
  }, [apiConnected, teamId]);

  return {
    ...query,
    connected,
    configured,
    channelTitle: query.data?.channelTitle ?? null,
    connectedAt: query.data?.connectedAt ?? null,
    publishing: query.data?.publishing,
    serverConfigured: query.data?.serverConfigured ?? null,
  };
}
