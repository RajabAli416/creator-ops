import React, { useState } from 'react';
import { useWorkspace } from '@/lib/workspace.jsx';
import { useNavigate } from 'react-router-dom';
import { Play, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

export default function Onboarding() {
  const { createOrg } = useWorkspace();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await createOrg({ name: form.name, slug, description: form.description });
    setCreating(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 mb-4">
            <Play className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Creator Ops</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your first workspace to get started</p>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <Label>Workspace Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm({
                ...form,
                name: e.target.value,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
              })}
              placeholder="e.g. My YouTube Team"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="What does your team create?"
              className="mt-1 h-20"
            />
          </div>
          <Button 
            onClick={handleCreate}
            disabled={creating || !form.name.trim()}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {creating ? 'Setting up...' : 'Create Workspace'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span>You can create more workspaces later</span>
        </div>
      </motion.div>
    </div>
  );
}