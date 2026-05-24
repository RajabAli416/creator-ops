import { useQuery, useQueryClient } from '@tanstack/react-query';
import { googleApiClient } from '@/api/google';
import { useGoogleConnection } from '@/hooks/useGoogleConnection';

const SCAN_INTERVAL_MS = 90_000;

/**
 * Polls Drive for final videos and refreshes content when Google is connected.
 */
export function usePipelineDriveSync(teamId, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { connected } = useGoogleConnection(teamId && enabled ? teamId : null);

  useQuery({
    queryKey: ['drive-scan', teamId],
    queryFn: async () => {
      await googleApiClient.scanDrive(teamId);
      await queryClient.invalidateQueries({ queryKey: ['content', teamId] });
    },
    enabled: !!teamId && connected && enabled,
    refetchInterval: SCAN_INTERVAL_MS,
    staleTime: 30_000,
  });
}
