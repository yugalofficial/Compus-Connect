import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';

interface PublicNavbarProps {
  forceShow?: boolean;
}

export default function PublicNavbar({ forceShow = false }: PublicNavbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  if (user && !forceShow) return null;

  const links = [
    { label: 'Home', to: '/' },
    { label: 'Explore Events', to: '/explore' },
    { label: 'Societies', to: '/societies' },
    { label: 'Verify Certificate', to: '/verify-certificate' },
    { label: 'Guide', to: '/how-to-use' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-3 sm:px-6 glass border-b border-border-subtle">
      <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-2 sm:gap-6 min-w-0">
        <Link
          to="/"
          className="text-base sm:text-lg font-extrabold tracking-tight font-display whitespace-nowrap shrink-0 flex items-center gap-2 min-w-0"
        >
          <span className="truncate">
            Campus <span className="text-primary">Connect</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-secondary">
          {links.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  active
                    ? 'text-foreground border-primary font-semibold'
                    : 'border-transparent hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <PWAInstallButton variant="compact" />
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden sm:inline-flex px-3.5 py-2 rounded-xl border border-border-subtle text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 hover:bg-secondary/10 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/login?mode=register"
            className="px-3 sm:px-4 py-2 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="lg:hidden w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-foreground shrink-0"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden absolute left-0 right-0 top-full glass border-b border-border-subtle px-4 py-4 shadow-2xl space-y-1.5 z-50">
          {links.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-primary text-white' : 'text-foreground hover:bg-secondary/10'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-border-subtle flex gap-2 sm:hidden">
            <Link
              to="/login"
              className="flex-1 py-2.5 rounded-xl border border-border-subtle text-center text-sm font-semibold"
            >
              Sign In
            </Link>
            <Link
              to="/login?mode=register"
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-center text-sm font-semibold"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
