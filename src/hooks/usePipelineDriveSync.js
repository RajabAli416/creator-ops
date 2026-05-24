import { useQuery, useQueryClient } from '@tanstack/react-query';
import { googleApiClient } from '@/api/google';

const SCAN_INTERVAL_MS = 90_000;

/**
 * Polls Drive for final videos and refreshes content when Google is connected.
 */
export function usePipelineDriveSync(teamId, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['google-status', teamId],
    queryFn: () => googleApiClient.getStatus(teamId),
    enabled: !!teamId && enabled,
  });

  const connected = status?.connected;

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
