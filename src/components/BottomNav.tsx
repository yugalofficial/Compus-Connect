import { Home, Search, Calendar, User, Plus, LayoutDashboard, Utensils, Bell, Shield, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const location = useLocation();
  const { user, isOrganizer, isAdmin, isCanteen, isApproved, unreadNotifications } = useAuth();

  if (!user || !isApproved) return null;

  const studentItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Search, label: 'Explore', path: '/explore' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Bell, label: 'Alerts', path: '/notifications', badge: unreadNotifications },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const organizerItems = [
    { icon: LayoutDashboard, label: 'Hub', path: '/dashboard' },
    { icon: Plus, label: 'Create', path: '/create' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Bell, label: 'Alerts', path: '/notifications', badge: unreadNotifications },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const canteenItems = [
    { icon: Utensils, label: 'Canteen', path: '/canteen' },
    { icon: Bell, label: 'Alerts', path: '/notifications', badge: unreadNotifications },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const adminItems = [
    { icon: Shield, label: 'Admin', path: '/admin' },
    { icon: LayoutDashboard, label: 'Events', path: '/dashboard' },
    { icon: Utensils, label: 'Canteen', path: '/canteen' },
    { icon: Bell, label: 'Alerts', path: '/notifications', badge: unreadNotifications },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const navItems = isAdmin
    ? adminItems
    : isOrganizer
      ? organizerItems
      : isCanteen
        ? canteenItems
        : studentItems;

  return (
    <nav
      aria-label="Mobile navigation"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        minHeight: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="md:hidden fixed bottom-0 inset-x-0 z-[150] bg-surface/95 backdrop-blur-xl border-t border-border-subtle shadow-[0_-8px_24px_rgba(0,0,0,0.08)] flex items-center justify-around gap-0.5 pt-1.5"
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 min-w-0 max-w-[88px] flex flex-col items-center justify-center min-h-[46px] px-1 py-1 rounded-xl gap-1 relative touch-manipulation active:scale-95 transition-transform"
          >
            <div className={cn('relative transition-colors', isActive ? 'text-primary' : 'text-secondary')}>
              <item.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </div>
            <span
              className={cn(
                'text-[10px] leading-none whitespace-nowrap truncate max-w-full',
                isActive ? 'text-primary font-semibold' : 'text-secondary font-medium'
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
