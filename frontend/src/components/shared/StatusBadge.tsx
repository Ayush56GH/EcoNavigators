import React from 'react';

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: 'critical' | 'warning' | 'cyan' | 'muted' | 'info' | 'success' | 'deferred';
  icon?: React.ReactNode;
  className?: string;
}

export default function StatusBadge({
  children,
  variant = 'cyan',
  icon,
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`status-badge ${variant} ${className}`}>
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
}
