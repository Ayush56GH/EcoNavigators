'use client';

import React, { useState } from 'react';
import { Compass, Menu, X } from 'lucide-react';
import { navLinks } from '@/data/navigation';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <a className="logo" href="#home">
        <Compass size={24} color="#00d7b2" />
        <span>EcoNavigators</span>
      </a>

      <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
        {navLinks.map((link) => (
          <li key={link.label}>
            <a
              className={link.isCta ? 'btn-signup-nav' : ''}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <button
        className="mobile-menu"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
        type="button"
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </nav>
  );
}
