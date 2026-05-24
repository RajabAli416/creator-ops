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

export default function Pipeline() {
  const { currentOrg, canCreateContent, hasPermission } = useWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState('idea');

  const canPublish = hasPermission(['owner', 'manager']);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['content', currentOrg?.id],
    queryFn: () => api.entities.ContentItem.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  usePipelineDriveSync(currentOrg?.id);

  const handleAddContent = (stageId) => {
    setDefaultStage(stageId);
    setCreateOpen(true);
  };

  const handlePublished = () => {
    queryClient.invalidateQueries({ queryKey: ['content', currentOrg?.id] });
  };

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="Content Pipeline"
        description="Production stages update automatically from Drive and publishing. Open a card for details."
      >
        {canCreateContent && (
          <Button
            onClick={() => {
              setDefaultStage('idea');
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
                canAdd={canCreateContent}
                onAddContent={handleAddContent}
                organizationId={currentOrg.id}
                canPublish={canPublish}
                onPublished={handlePublished}
              />
            );
          })}
        </div>
      )}

      <CreateContentModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatus={defaultStage}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['content', currentOrg?.id] })}
      />
    </div>
  );
}
