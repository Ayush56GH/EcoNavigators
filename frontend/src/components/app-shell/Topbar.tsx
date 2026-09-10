'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Settings, User, LogOut, Radio, AlertOctagon } from 'lucide-react';
import { useAppMode } from '@/utils/appMode';

interface TopbarProps {
  searchPlaceholder?: string;
  filters?: React.ReactNode;
}

interface UserInfo {
  id?: number;
  username?: string;
  email?: string;
}

export default function Topbar({
  searchPlaceholder = 'Search vessels, regions, or alerts...',
  filters,
}: TopbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const { mode, setMode } = useAppMode();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore JSON parse failure
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/vessels?search=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/vessels');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  return (
    <header className="dashboard-topbar">
      {/* Search Input & Contextual Filters */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '1rem', maxWidth: '820px' }}>
        <form onSubmit={handleSearchSubmit} className="topbar-search-container">
          <button
            type="submit"
            aria-label="Search"
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              zIndex: 1,
            }}
          >
            <Search size={16} />
          </button>
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="topbar-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </form>

        {filters && <div className="topbar-filter-group">{filters}</div>}
      </div>

      {/* Quick Action Icons & LIVE/DEMO Mode Switcher */}
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Application Mode Indicator & Toggle */}
        <button
          onClick={() => setMode(mode === 'live' ? 'demo' : 'live')}
          title={mode === 'live' ? 'Switch to Demo Mode (Synthetic fixtures)' : 'Switch to Live Mode (Real backend stream)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: mode === 'demo' ? 'rgba(244, 63, 94, 0.18)' : 'rgba(0, 215, 178, 0.12)',
            border: mode === 'demo' ? '1.5px solid #f43f5e' : '1.5px solid #00d7b2',
            color: mode === 'demo' ? '#f43f5e' : '#00d7b2',
            boxShadow: mode === 'demo' ? '0 0 12px rgba(244, 63, 94, 0.3)' : '0 0 10px rgba(0, 215, 178, 0.2)',
          }}
        >
          {mode === 'demo' ? (
            <>
              <AlertOctagon size={13} color="#f43f5e" />
              <span>DEMO MODE</span>
            </>
          ) : (
            <>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#00d7b2',
                  boxShadow: '0 0 8px #00d7b2',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span>LIVE MODE</span>
            </>
          )}
        </button>

        <button className="topbar-icon-btn" title="Alerts & Notifications">
          <Bell size={18} />
          <span className="topbar-notification-badge" />
        </button>
        <button className="topbar-icon-btn" title="Platform Settings">
          <Settings size={18} />
        </button>
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="topbar-user-avatar" title={user.email || 'Commander'}>
              {user.username ? user.username.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary, #e2e8f0)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.username || 'Commander'}
            </span>
            <button
              onClick={handleLogout}
              className="topbar-icon-btn"
              title="Log out"
              style={{ width: '28px', height: '28px', color: '#ef4444', marginLeft: '2px' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="topbar-user-avatar" title="Commander Profile" onClick={() => router.push('/login')}>
            <User size={16} />
          </div>
        )}
      </div>
    </header>
  );
}
