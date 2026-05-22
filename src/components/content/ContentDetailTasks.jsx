import React, { useState } from 'react';
import { api } from '@/api/client';
import { logActivity } from '@/lib/activity';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG } from '@/lib/workspace.jsx';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ContentDetailTasks({ contentItemId, organizationId }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', contentItemId],
    queryFn: () => api.entities.Task.filter({ content_item_id: contentItemId }),
    enabled: !!contentItemId,
  });

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    await api.entities.Task.create({
      organization_id: organizationId,
      content_item_id: contentItemId,
      title: newTitle,
      status: 'todo',
      priority: 'medium',
    });
    await logActivity({
      organizationId,
      contentItemId,
      action: 'created',
      entityType: 'task',
      details: `Added task "${newTitle}"`,
    });
    setNewTitle('');
    setAdding(false);
    queryClient.invalidateQueries({ queryKey: ['tasks', contentItemId] });
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await api.entities.Task.update(task.id, { status: newStatus });
    await logActivity({
      organizationId,
      contentItemId,
      taskId: task.id,
      action: newStatus === 'done' ? 'completed' : 'updated',
      entityType: 'task',
      details: newStatus === 'done' ? `Completed task "${task.title}"` : `Reopened task "${task.title}"`,
    });
    queryClient.invalidateQueries({ queryKey: ['tasks', contentItemId] });
  };

  const deleteTask = async (task) => {
    await api.entities.Task.delete(task.id);
    queryClient.invalidateQueries({ queryKey: ['tasks', contentItemId] });
  };

  const completed = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Tasks</h3>
          {tasks.length > 0 && (
            <span className="text-xs text-muted-foreground">{completed}/{tasks.length} done</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />Add
        </Button>
      </div>

      <div className="divide-y divide-border">
        {adding && (
          <div className="p-3 flex items-center gap-2">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="text-sm h-8"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
            />
            <Button size="sm" className="h-8" onClick={handleAddTask}>Add</Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        )}
        {tasks.map(task => {
          const priority = PRIORITY_CONFIG[task.priority];
          return (
            <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors group">
              <button onClick={() => toggleTask(task)} className="flex-shrink-0">
                {task.status === 'done' ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
                ) : (
                  <Circle className="w-4.5 h-4.5 text-muted-foreground hover:text-primary transition-colors" />
                )}
              </button>
              <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.title}
              </span>
              {priority && (
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${priority.color}`}>
                  {priority.label}
                </Badge>
              )}
              {task.due_date && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />{format(new Date(task.due_date), 'MMM d')}
                </span>
              )}
              <button 
                onClick={() => deleteTask(task)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          );
        })}
        {tasks.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-6">No tasks yet</p>
        )}
      </div>
    </div>
  );
}