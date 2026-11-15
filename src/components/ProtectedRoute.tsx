import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Clock, LogOut, CheckCircle2, Mail, User as UserIcon } from 'lucide-react';

export function getRoleHomePath(role?: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'organizer') return '/dashboard';
  if (role === 'canteen') return '/canteen';
  return '/home';
}

function PendingApprovalGate() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const isRejected = user.status === 'rejected' || user.status === 'suspended';

  return (
    <div className="min-h-[calc(100dvh-64px)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg glass rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
          isRejected ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500'
        }`}>
          {isRejected ? <ShieldAlert size={28} /> : <Clock size={28} />}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          {isRejected
            ? user.status === 'suspended'
              ? 'Account Suspended'
              : 'Registration Not Approved'
            : 'Awaiting Super Admin Approval'}
        </h1>

        <p className="text-secondary text-sm leading-relaxed mb-6">
          {isRejected
            ? 'Your account access has been restricted by the Campus Connect Super Admin. Please contact the campus administrator if you believe this is an error.'
            : 'Your profile and credentials have been submitted. Once the Super Admin verifies and approves your account, your dashboard will unlock automatically.'}
        </p>

        <div className="rounded-2xl border border-border-subtle p-4 space-y-3 mb-6 bg-background/50">
          <div className="flex items-center justify-between gap-3 text-sm min-w-0">
            <span className="text-secondary flex items-center gap-2 shrink-0"><UserIcon size={15} /> Name</span>
            <span className="font-semibold truncate min-w-0 text-right">{user.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm min-w-0">
            <span className="text-secondary flex items-center gap-2 shrink-0"><Mail size={15} /> Email</span>
            <span className="font-medium truncate min-w-0 text-right">{user.email}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary shrink-0">Requested Role</span>
            <span className="font-semibold capitalize text-right">{user.role === 'organizer' ? 'Organiser' : user.role}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary shrink-0">Approval Status</span>
            <span className={`font-semibold capitalize flex items-center gap-1.5 ${
              isRejected ? 'text-red-500' : 'text-amber-500'
            }`}>
              <CheckCircle2 size={14} />
              {user.status || 'pending'}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full py-3.5 px-4 rounded-xl border border-border-subtle font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function AuthSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary" />
    </div>
  );
}

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isApproved } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isApproved) return <PendingApprovalGate />;

  return <>{children}</>;
};

export const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isApproved, isAdmin, isOrganizer, isCanteen } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isApproved) return <PendingApprovalGate />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isOrganizer) return <Navigate to="/dashboard" replace />;
  if (isCanteen) return <Navigate to="/canteen" replace />;

  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to={getRoleHomePath(user.role)} replace />;

  return <>{children}</>;
};

export const OrganiserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isOrganizer, isAdmin, isApproved } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isApproved) return <PendingApprovalGate />;
  if (!isOrganizer && !isAdmin) return <Navigate to={getRoleHomePath(user.role)} replace />;

  return <>{children}</>;
};

export const CanteenRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isCanteen, isAdmin, isApproved } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isApproved) return <PendingApprovalGate />;
  if (!isCanteen && !isAdmin) return <Navigate to={getRoleHomePath(user.role)} replace />;

  return <>{children}</>;
};
