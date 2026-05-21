import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-72 space-y-3">
          <Skeleton className="h-8 w-24" />
          {Array(3).fill(0).map((_, j) => (
            <div key={j} className="bg-card border border-border rounded-lg p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}