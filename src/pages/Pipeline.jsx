import React, { useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace, PIPELINE_STAGES } from '@/lib/workspace.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import PipelineColumn from '@/components/pipeline/PipelineColumn';
import CreateContentModal from '@/components/pipeline/CreateContentModal';
import EmptyState from '@/components/shared/EmptyState';
import { KanbanSkeleton } from '@/components/shared/LoadingSkeleton';
import { usePipelineDriveSync } from '@/hooks/usePipelineDriveSync';
import { useGoogleConnection } from '@/hooks/useGoogleConnection';
import GoogleConnectionStatus from '@/components/integrations/GoogleConnectionStatus';

export default function Pipeline() {
  const { currentOrg, canCreateContent, canPublish, hasPermission } = useWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const isOwner = hasPermission(['owner']);

  const {
    connected: googleConnected,
    configured: googleConfigured,
    channelTitle: googleChannelTitle,
    connectedAt: googleConnectedAt,
    isLoading: googleStatusLoading,
    isError: googleStatusError,
    error: googleStatusErrorDetail,
    refetch: refetchGoogleStatus,
    serverConfigured,
  } = useGoogleConnection(currentOrg?.id);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['content', currentOrg?.id],
    queryFn: () => api.entities.ContentItem.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  usePipelineDriveSync(currentOrg?.id);

  const handleAddContent = () => {
    setCreateOpen(true);
  };

  const handlePublished = () => {
    queryClient.invalidateQueries({ queryKey: ['content', currentOrg?.id] });
  };

  if (!currentOrg) return null;

  return (
    <div>
      {(canPublish || isOwner) && (
        <div className="mb-4">
          <GoogleConnectionStatus
            connected={googleConnected}
            configured={googleConfigured}
            channelTitle={googleChannelTitle}
            connectedAt={googleConnectedAt}
            isLoading={googleStatusLoading}
            isError={googleStatusError}
            error={googleStatusErrorDetail}
            onRetry={() => refetchGoogleStatus()}
            serverConfigured={serverConfigured}
            compact
          />
        </div>
      )}

      <PageHeader
        title="Content Pipeline"
        description="Four stages — Planned → In production → Ready to publish → Published. Updates automatically from Drive and YouTube."
      >
        {canCreateContent && (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Content
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <KanbanSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Pipeline is empty"
          description={
            canCreateContent
              ? 'Create your first content item to start tracking your production workflow.'
              : 'No content yet. Owners and managers can add items to the pipeline.'
          }
          actionLabel={canCreateContent ? 'Create Content' : undefined}
          onAction={canCreateContent ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 lg:-mx-6 lg:px-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageItems = items
              .filter((i) => i.status === stage.id)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            return (
              <PipelineColumn
                key={stage.id}
                stageId={stage.id}
                items={stageItems}
                canAdd={canCreateContent && stage.id === 'planned'}
                onAddContent={handleAddContent}
                organizationId={currentOrg.id}
                canPublish={canPublish}
                isOwner={isOwner}
                googleConnected={googleConnected}
                onPublished={handlePublished}
              />
            );
          })}
        </div>
      )}

      <CreateContentModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['content', currentOrg?.id] })}
      />
    </div>
  );
}
