import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Bell, HelpCircle, ChevronDown } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';
import { getInitials } from '../lib/media';

export default function RoleHeader() {
  const { user, logout, isAdmin, isOrganizer, isCanteen, isApproved, unreadNotifications } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const getDashboardLink = () => {
    if (isAdmin) return '/admin';
    if (isOrganizer) return '/dashboard';
    if (isCanteen) return '/canteen';
    return '/home';
  };

  const navLinks = isAdmin
    ? [
        { label: 'Admin Console', path: '/admin' },
        { label: 'Organiser Hub', path: '/dashboard' },
        { label: 'Canteen Portal', path: '/canteen' },
        { label: 'Explore', path: '/explore' },
      ]
    : isOrganizer
      ? [
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Create Event', path: '/create' },
          { label: 'Explore', path: '/explore' },
          { label: 'Guide', path: '/how-to-use' },
        ]
      : isCanteen
        ? [
            { label: 'Canteen Portal', path: '/canteen' },
            { label: 'Notifications', path: '/notifications' },
            { label: 'Guide', path: '/how-to-use' },
          ]
        : [
            { label: 'Home', path: '/home' },
            { label: 'Explore', path: '/explore' },
            { label: 'Calendar', path: '/calendar' },
            { label: 'Alerts', path: '/notifications' },
          ];

  return (
    <header className="sticky top-0 z-[100] w-full h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-4 sm:px-6 glass border-b border-border-subtle">
      <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to={getDashboardLink()}
          className="text-lg font-extrabold tracking-tight font-display whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span>Campus <span className="text-primary">Connect</span></span>
        </Link>

        {/* Zone 2: Desktop Navigation Links */}
        {isApproved && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-secondary">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-foreground border-primary font-semibold'
                      : 'border-transparent hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Controls & Account Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton variant="compact" />
          <ThemeToggle />

          {isApproved && (
            <button
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              className="w-10 h-10 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-primary hover:bg-primary/5 transition-colors relative"
            >
              <Bell size={18} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              className="flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-xl border border-border-subtle hover:bg-secondary/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  getInitials(user.name)
                )}
              </div>
              <span className="hidden sm:inline text-xs font-semibold max-w-[110px] truncate">{user.name}</span>
              <ChevronDown size={14} className="text-secondary" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 glass rounded-2xl p-2 shadow-2xl z-[200]">
                <div className="px-3 py-2 border-b border-border-subtle mb-1">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-xs text-secondary truncate">{user.email}</p>
                  <p className="text-[11px] text-primary font-medium capitalize mt-0.5">
                    {user.role === 'organizer' ? 'Organiser' : user.role} · {user.status || 'approved'}
                  </p>
                </div>
                {isApproved && (
                  <>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary/10 transition-colors"
                    >
                      <User size={16} /> Profile & Settings
                    </Link>
                    <Link
                      to="/how-to-use"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary/10 transition-colors"
                    >
                      <HelpCircle size={16} /> Platform Guide
                    </Link>
                  </>
                )}
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-xl transition-colors mt-1"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
