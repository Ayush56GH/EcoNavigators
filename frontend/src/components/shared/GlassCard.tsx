import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function GlassCard({
  children,
  className = '',
  header,
  style,
}: GlassCardProps) {
  return (
    <div className={`glass-card ${className}`} style={style}>
      {header && <div className="glass-card-header">{header}</div>}
      <div className="glass-card-body">{children}</div>
    </div>
  );
}
