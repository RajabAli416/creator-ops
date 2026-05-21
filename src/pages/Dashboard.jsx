import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorkspace, PIPELINE_STAGES } from '@/lib/workspace.jsx';
import { useQuery } from '@tanstack/react-query';
import { 
  Kanban, CheckSquare, AlertTriangle, Clock, TrendingUp, Film 
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import DeadlinesList from '@/components/dashboard/DeadlinesList';
import EmptyState from '@/components/shared/EmptyState';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { isPast, isToday, addDays } from 'date-fns';

export default function Dashboard() {
  const { currentOrg } = useWorkspace();

  const { data: contentItems = [], isLoading: loadingContent } = useQuery({
    queryKey: ['content', currentOrg?.id],
    queryFn: () => base44.entities.ContentItem.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', currentOrg?.id],
    queryFn: () => base44.entities.Task.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', currentOrg?.id],
    queryFn: () => base44.entities.ActivityLog.filter({ organization_id: currentOrg.id }, '-created_date', 15),
    enabled: !!currentOrg,
  });

  if (!currentOrg) {
    return (
      <EmptyState
        icon={Film}
        title="Welcome to Creator Ops"
        description="Create your first workspace to get started with managing your content pipeline."
        actionLabel="Go to Settings"
        onAction={() => window.location.href = '/settings?tab=workspace'}
      />
    );
  }

  const overdueItems = contentItems.filter(
    i => i.due_date && isPast(new Date(i.due_date)) && !isToday(new Date(i.due_date)) && i.status !== 'published'
  );
  const overdueTasks = tasks.filter(
    t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== 'done'
  );
  const inProgress = contentItems.filter(i => !['idea', 'published'].includes(i.status));
  const published = contentItems.filter(i => i.status === 'published');
  const completedTasks = tasks.filter(t => t.status === 'done');

  // Upcoming deadlines: next 14 days
  const upcomingItems = contentItems
    .filter(i => i.due_date && new Date(i.due_date) <= addDays(new Date(), 14) && i.status !== 'published')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 8);

  const isLoading = loadingContent || loadingTasks;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Dashboard" description={`Overview of ${currentOrg.name}`} />

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Active Content"
            value={inProgress.length}
            subtitle={`${contentItems.length} total items`}
            icon={Kanban}
            iconColor="bg-primary/10 text-primary"
            delay={0}
          />
          <StatCard
            title="Open Tasks"
            value={tasks.length - completedTasks.length}
            subtitle={`${completedTasks.length} completed`}
            icon={CheckSquare}
            iconColor="bg-blue-500/10 text-blue-400"
            delay={0.05}
          />
          <StatCard
            title="Overdue"
            value={overdueItems.length + overdueTasks.length}
            subtitle="Items & tasks past due"
            icon={AlertTriangle}
            iconColor="bg-red-500/10 text-red-400"
            delay={0.1}
          />
          <StatCard
            title="Published"
            value={published.length}
            subtitle="Content delivered"
            icon={TrendingUp}
            iconColor="bg-green-500/10 text-green-400"
            delay={0.15}
          />
        </div>
      )}

      {/* Pipeline Overview */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Overview</h2>
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {PIPELINE_STAGES.map(stage => {
            const count = contentItems.filter(i => i.status === stage.id).length;
            return (
              <div key={stage.id} className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{stage.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Activity</h2>
          </div>
          <div className="p-3 max-h-96 overflow-y-auto">
            <ActivityFeed activities={activities} />
          </div>
        </div>

        {/* Deadlines */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Upcoming Deadlines</h2>
          </div>
          <div className="p-3 max-h-96 overflow-y-auto">
            <DeadlinesList items={upcomingItems} />
          </div>
        </div>
      </div>
    </div>
  );
}