import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, subtitle, icon: Icon, iconColor, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1.5 text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${iconColor || 'bg-primary/10'}`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor ? '' : 'text-primary'}`} />
        </div>
      </div>
    </motion.div>
  );
}