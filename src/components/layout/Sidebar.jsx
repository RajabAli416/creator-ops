import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/lib/workspace.jsx';
import { 
  LayoutDashboard, 
  Kanban, 
  CheckSquare, 
  Users, 
  Settings, 
  MessageSquare,
  Plus,
  ChevronDown,
  Zap,
  Menu,
  X,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/team', icon: Users, label: 'Team' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const { currentOrg, orgs, switchOrg } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Workspace Switcher */}
      <div className="p-4 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Play className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">
                  {currentOrg?.name || 'No Workspace'}
                </p>
                <p className="text-xs text-muted-foreground">Creator Team</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {orgs.map(org => (
              <DropdownMenuItem key={org.id} onClick={() => switchOrg(org.id)}>
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center mr-2">
                  <Play className="w-3 h-3 text-primary" />
                </div>
                {org.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings?tab=workspace" className="flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                New Workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Creator Ops v1.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button 
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-50 transition-transform duration-300 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <button 
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}