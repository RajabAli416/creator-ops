import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import ContentCard from './ContentCard';
import { PIPELINE_STAGES } from '@/lib/workspace.jsx';

export default function PipelineColumn({ stageId, items, onAddContent }) {
  const stage = PIPELINE_STAGES.find(s => s.id === stageId);
  if (!stage) return null;

  return (
    <div className="flex-shrink-0 w-72">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${stage.color}`}>
            {stage.label}
          </span>
          <span className="text-xs text-muted-foreground font-medium">{items.length}</span>
        </div>
        <button 
          onClick={() => onAddContent(stageId)}
          className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stageId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2.5 min-h-[200px] rounded-lg p-1.5 transition-colors ${
              snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : ''
            }`}
          >
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                  <ContentCard item={item} provided={provided} snapshot={snapshot} />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}