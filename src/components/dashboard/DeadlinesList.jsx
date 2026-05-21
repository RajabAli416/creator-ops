import React from 'react';
import { Link } from 'react-router-dom';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { Calendar, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG, PIPELINE_STAGES } from '@/lib/workspace.jsx';

export default function DeadlinesList({ items }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">No upcoming deadlines</p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map(item => {
        const dueDate = new Date(item.due_date);
        const overdue = isPast(dueDate) && !isToday(dueDate);
        const today = isToday(dueDate);
        const tomorrow = isTomorrow(dueDate);
        const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
        const stage = PIPELINE_STAGES.find(s => s.id === item.status);

        let dateLabel = format(dueDate, 'MMM d');
        if (today) dateLabel = 'Today';
        else if (tomorrow) dateLabel = 'Tomorrow';

        return (
          <Link
            key={item.id}
            to={`/content/${item.id}`}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
          >
            <div className={`p-1.5 rounded ${overdue ? 'bg-red-500/10' : 'bg-secondary'}`}>
              <Calendar className={`w-3.5 h-3.5 ${overdue ? 'text-red-400' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {stage && (
                  <span className={`text-[10px] px-1.5 py-0 rounded border ${stage.color}`}>
                    {stage.label}
                  </span>
                )}
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${priority.color}`}>
                  {priority.label}
                </Badge>
              </div>
            </div>
            <span className={`text-xs font-medium ${
              overdue ? 'text-red-400' : today ? 'text-orange-400' : 'text-muted-foreground'
            }`}>
              {overdue ? 'Overdue' : dateLabel}
            </span>
          </Link>
        );
      })}
    </div>
  );
}