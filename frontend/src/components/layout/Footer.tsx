import React from 'react';
import { Ship } from 'lucide-react';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Ship size={24} />
        <div>
          <strong>EcoNavigators</strong>
          <span>Marine environmental intelligence</span>
        </div>
      </div>
      <span>Built for clearer marine investigations.</span>
      <span>© {new Date().getFullYear()} EcoNavigators</span>
    </footer>
  );
}
