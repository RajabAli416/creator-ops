import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorkspace, PIPELINE_STAGES } from '@/lib/workspace.jsx';
import { logActivity } from '@/lib/activity';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext } from '@hello-pangea/dnd';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import PipelineColumn from '@/components/pipeline/PipelineColumn';
import CreateContentModal from '@/components/pipeline/CreateContentModal';
import EmptyState from '@/components/shared/EmptyState';
import { KanbanSkeleton } from '@/components/shared/LoadingSkeleton';

export default function Pipeline() {
  const { currentOrg } = useWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState('idea');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['content', currentOrg?.id],
    queryFn: () => base44.entities.ContentItem.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const item = items.find(i => i.id === draggableId);
    if (!item) return;

    const newStatus = destination.droppableId;
    
    // Optimistic update
    queryClient.setQueryData(['content', currentOrg?.id], (old) => {
      return old.map(i => i.id === draggableId ? { ...i, status: newStatus } : i);
    });

    await base44.entities.ContentItem.update(draggableId, {
      status: newStatus,
      sort_order: destination.index,
    });

    if (source.droppableId !== destination.droppableId) {
      const fromStage = PIPELINE_STAGES.find(s => s.id === source.droppableId);
      const toStage = PIPELINE_STAGES.find(s => s.id === destination.droppableId);
      await logActivity({
        organizationId: currentOrg.id,
        contentItemId: draggableId,
        action: 'moved',
        entityType: 'content',
        details: `Moved "${item.title}" from ${fromStage?.label} to ${toStage?.label}`,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['content', currentOrg?.id] });
  };

  const handleAddContent = (stageId) => {
    setDefaultStage(stageId);
    setCreateOpen(true);
  };

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader title="Content Pipeline" description="Drag and drop content through production stages">
        <Button onClick={() => { setDefaultStage('idea'); setCreateOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Content
        </Button>
      </PageHeader>

      {isLoading ? (
        <KanbanSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Pipeline is empty"
          description="Create your first content item to start tracking your production workflow."
          actionLabel="Create Content"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 lg:-mx-6 lg:px-6">
            {PIPELINE_STAGES.map(stage => {
              const stageItems = items
                .filter(i => i.status === stage.id)
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
              return (
                <PipelineColumn
                  key={stage.id}
                  stageId={stage.id}
                  items={stageItems}
                  onAddContent={handleAddContent}
                />
              );
            })}
          </div>
        </DragDropContext>
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