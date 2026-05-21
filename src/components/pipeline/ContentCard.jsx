import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MessageSquare, Paperclip, Flag } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG } from '@/lib/workspace.jsx';
import { format, isPast, isToday } from 'date-fns';

export default function ContentCard({ item, provided, snapshot }) {
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
  const isOverdue = item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date));
  const assignees = item.assigned_members || [];

  return (
    <div
      ref={provided?.innerRef}
      {...(provided?.draggableProps || {})}
      {...(provided?.dragHandleProps || {})}
      className={`bg-card border border-border rounded-lg p-3.5 cursor-pointer hover:border-primary/30 transition-all duration-200 group ${
        snapshot?.isDragging ? 'shadow-xl shadow-primary/10 border-primary/40 rotate-1' : ''
      }`}
    >
      <Link to={`/content/${item.id}`} className="block">
        {/* Labels */}
        {item.labels?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {item.labels.slice(0, 3).map((label, i) => (
              <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {item.title}
        </h4>

        {/* Description preview */}
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${priority.color}`}>
              <Flag className="w-2.5 h-2.5 mr-1" />
              {priority.label}
            </Badge>
            {item.due_date && (
              <span className={`text-[10px] flex items-center gap-1 ${
                isOverdue ? 'text-red-400' : 'text-muted-foreground'
              }`}>
                <Calendar className="w-2.5 h-2.5" />
                {format(new Date(item.due_date), 'MMM d')}
              </span>
            )}
          </div>

          {/* Assignees */}
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((email, i) => (
              <Avatar key={i} className="w-5 h-5 border border-card">
                <AvatarFallback className="text-[8px] bg-secondary text-muted-foreground">
                  {email[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 3 && (
              <Avatar className="w-5 h-5 border border-card">
                <AvatarFallback className="text-[8px] bg-secondary text-muted-foreground">
                  +{assignees.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}