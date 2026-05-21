import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Plus, ArrowRight, UserPlus, Edit, Trash2, CheckCircle2, Upload, MessageSquare 
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ACTION_ICONS = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  moved: ArrowRight,
  assigned: UserPlus,
  commented: MessageSquare,
  uploaded: Upload,
  completed: CheckCircle2,
};

export default function ActivityFeed({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => {
        const Icon = ACTION_ICONS[activity.action] || Edit;
        const initials = activity.actor_name
          ? activity.actor_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          : activity.actor_email?.[0]?.toUpperCase() || '?';

        return (
          <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
            <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
              <AvatarFallback className="text-[10px] bg-secondary text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground line-clamp-2">
                <span className="font-medium">{activity.actor_name || activity.actor_email}</span>{' '}
                <span className="text-muted-foreground">{activity.details}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}
              </p>
            </div>
            <div className="p-1.5 rounded bg-secondary flex-shrink-0">
              <Icon className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        );
      })}
    </div>
  );
}