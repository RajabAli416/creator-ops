import React, { useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace, PRIORITY_CONFIG } from '@/lib/workspace.jsx';
import { logActivity } from '@/lib/activity';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import {
  CheckSquare, Circle, CheckCircle2, Clock, Flag, Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingSkeleton';

export default function Tasks() {
  const { currentOrg } = useWorkspace();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks', currentOrg?.id],
    queryFn: () => api.entities.Task.filter({ organization_id: currentOrg.id }, '-created_date'),
    enabled: !!currentOrg,
  });

  const { data: contentItems = [] } = useQuery({
    queryKey: ['content', currentOrg?.id],
    queryFn: () => api.entities.ContentItem.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await api.entities.Task.update(task.id, { status: newStatus });
    await logActivity({
      organizationId: currentOrg.id,
      contentItemId: task.content_item_id,
      taskId: task.id,
      action: newStatus === 'done' ? 'completed' : 'updated',
      entityType: 'task',
      details: newStatus === 'done' ? `Completed task "${task.title}"` : `Reopened task "${task.title}"`,
    });
    queryClient.invalidateQueries({ queryKey: ['all-tasks', currentOrg?.id] });
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  if (!currentOrg) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Tasks" description="All tasks across your content pipeline">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="todo" className="text-xs">To Do</TabsTrigger>
            <TabsTrigger value="in_progress" className="text-xs">In Progress</TabsTrigger>
            <TabsTrigger value="done" className="text-xs">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {isLoading ? (
        <ListSkeleton rows={8} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={statusFilter === 'all' ? 'Tasks will appear here when you add them to content items.' : 'No tasks with this status.'}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {filteredTasks.map(task => {
            const content = contentItems.find(c => c.id === task.content_item_id);
            const priority = PRIORITY_CONFIG[task.priority];
            const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done';

            return (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors group">
                <button onClick={() => toggleTask(task)} className="flex-shrink-0">
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  {content && (
                    <Link to={`/content/${content.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      {content.title}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {priority && (
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${priority.color}`}>
                      <Flag className="w-2.5 h-2.5 mr-1" />{priority.label}
                    </Badge>
                  )}
                  {task.due_date && (
                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                      <Clock className="w-3 h-3" />{format(new Date(task.due_date), 'MMM d')}
                    </span>
                  )}
                  {task.assignee_email && (
                    <span className="text-[10px] bg-secondary rounded-full px-2 py-0.5 text-muted-foreground">
                      {task.assignee_email}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}