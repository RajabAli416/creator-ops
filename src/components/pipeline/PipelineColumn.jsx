import React from 'react';
import { Plus } from 'lucide-react';
import ContentCard from './ContentCard';
import { PIPELINE_STAGES } from '@/lib/workspace.jsx';

export default function PipelineColumn({
  stageId,
  items,
  canAdd = false,
  onAddContent,
  organizationId,
  canPublish = false,
  onPublished,
}) {
  const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
  if (!stage) return null;

  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${stage.color}`}>
            {stage.label}
          </span>
          <span className="text-xs text-muted-foreground font-medium">{items.length}</span>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => onAddContent(stageId)}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Add content to ${stage.label}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2.5 min-h-[200px] rounded-lg p-1.5">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            organizationId={organizationId}
            canPublish={canPublish}
            onPublished={onPublished}
          />
        ))}
      </div>
    </div>
  );
}
