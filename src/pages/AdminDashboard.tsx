import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  addDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db, provisionUserCredentials, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  User,
  Event,
  CanteenPayment,
  Registration,
  Society,
  UserRole,
  UserStatus,
  PlatformSettings,
} from '../types';
import {
  Users,
  Calendar,
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  Search,
  UserPlus,
  Edit3,
  Trash2,
  Settings,
  RefreshCw,
  Clock,
  X,
  Ticket,
  Building2,
  Image as ImageIcon,
  Coffee,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getInitials } from '../lib/media';
import { sendTransactionalEmail, syncToSheetsAndDrive } from '../lib/api';

type AdminTab = 'overview' | 'users' | 'events' | 'registrations' | 'societies' | 'payments' | 'settings';

export default function AdminDashboard() {
  const { user, platformSettings } = useAuth();
  const { showToast, confirm } = useToast();
  const navigate = useNavigate();

  const {
    users,
    events,
    registrations,
    societies,
    payments,
    loading,
  } = useDashboardData('admin');

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<'all' | Event['status']>('all');
  const [regSearch, setRegSearch] = useState('');
  const [regFilter, setRegFilter] = useState<
    'all' | 'pending' | 'confirmed' | 'rejected' | 'attended' | 'coupon_redeemed'
  >('all');
  const [syncing, setSyncing] = useState(false);

  // Proof Image Preview Lightbox
  const [previewProof, setPreviewProof] = useState<{ title: string; subtitle?: string; src: string } | null>(null);

  // Provision User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'organizer' as UserRole,
    phone: '',
    college: '',
    course: '',
    organisation: '',
    vendorName: '',
    upiId: '',
  });

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  // Platform Settings State
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>(platformSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm(platformSettings);
  }, [platformSettings]);

  // Cross-profile lookup maps
  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  const eventMap = useMemo(() => {
    const map: Record<string, Event> = {};
    events.forEach((ev) => {
      map[ev.id] = ev;
    });
    return map;
  }, [events]);

  const societyMap = useMemo(() => {
    const map: Record<string, Society> = {};
    societies.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [societies]);

  const societyByOrganizer = useMemo(() => {
    const map: Record<string, Society> = {};
    societies.forEach((s) => {
      if (s.organizerId) map[s.organizerId] = s;
    });
    return map;
  }, [societies]);

  const regsByEvent = useMemo(() => {
    const map: Record<string, Registration[]> = {};
    registrations.forEach((r) => {
      if (!map[r.eventId]) map[r.eventId] = [];
      map[r.eventId].push(r);
    });
    return map;
  }, [registrations]);

  const regsByUser = useMemo(() => {
    const map: Record<string, Registration[]> = {};
    registrations.forEach((r) => {
      if (!map[r.userId]) map[r.userId] = [];
      map[r.userId].push(r);
    });
    return map;
  }, [registrations]);

  const eventsByOrganizer = useMemo(() => {
    const map: Record<string, Event[]> = {};
    events.forEach((ev) => {
      if (!map[ev.organizerId]) map[ev.organizerId] = [];
      map[ev.organizerId].push(ev);
    });
    return map;
  }, [events]);

  const paymentsByVendor = useMemo(() => {
    const map: Record<string, CanteenPayment[]> = {};
    payments.forEach((p) => {
      if (!map[p.vendorId]) map[p.vendorId] = [];
      map[p.vendorId].push(p);
    });
    return map;
  }, [payments]);

  const notifyUser = async (targetUser: User, title: string, message: string, emailSubject?: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: targetUser.uid,
        title,
        message,
        type: 'account_update',
        read: false,
        createdAt: serverTimestamp(),
      });
      if (emailSubject && targetUser.email) {
        sendTransactionalEmail(
          {
            to: targetUser.email,
            subject: emailSubject,
            templateName: 'notification',
            params: { title, message },
          },
          platformSettings.appsScriptUrl
        ).catch(() => {});
      }
    } catch {
      // Non-blocking notification failure
    }
  };

  const handleUpdateUserStatus = async (target: User, status: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        status,
        updatedAt: new Date().toISOString(),
      });
      await notifyUser(
        target,
        `Account ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        status === 'approved'
          ? `Your ${target.role} profile has been approved by the Super Admin. You can now access your dashboard.`
          : `Your ${target.role} profile status was changed to ${status} by the Super Admin.`,
        `Campus Connect Account ${status.toUpperCase()}`
      );
      showToast(`${target.name} marked as ${status}.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${target.uid}`);
    }
  };

  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        name: editingUser.name.trim(),
        role: editingUser.role,
        status: editingUser.status || 'approved',
        phone: (editingUser.phone || '').trim(),
        college: (editingUser.college || '').trim(),
        course: (editingUser.course || '').trim(),
        organisation: (editingUser.organisation || '').trim(),
        vendorName: (editingUser.vendorName || '').trim(),
        upiId: (editingUser.upiId || '').trim(),
        points: Number(editingUser.points) || 0,
        updatedAt: new Date().toISOString(),
      });
      await notifyUser(
        editingUser,
        'Profile Updated by Super Admin',
        `Your account role is set to ${editingUser.role} (${editingUser.status}).`
      );
      showToast('User profile updated across all dashboards.', 'success');
      setEditingUser(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (target: User) => {
    if (target.uid === user?.uid) {
      showToast('You cannot delete your active Super Admin account.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete User Profile',
      message: `Remove ${target.name} (${target.email}) from Campus Connect? Their Firestore profile and portal access will be removed permanently.`,
      confirmText: 'Delete User',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'users', target.uid));
      showToast(`Deleted user ${target.name}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete user', 'error');
    }
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserForm.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      const uid = await provisionUserCredentials(
        newUserForm.email.trim(),
        newUserForm.password,
        newUserForm.name.trim()
      );
      const createdUser: User = {
        uid,
        name: newUserForm.name.trim(),
        email: newUserForm.email.trim(),
        role: newUserForm.role,
        status: 'approved',
        phone: newUserForm.phone.trim(),
        college: newUserForm.college.trim(),
        course: newUserForm.course.trim(),
        organisation: newUserForm.organisation.trim(),
        vendorName: newUserForm.vendorName.trim(),
        upiId: newUserForm.upiId.trim(),
        interests: [],
        points: 0,
        badges: [],
        followedSocieties: [],
        photoURL: '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), createdUser);
      await addDoc(collection(db, 'notifications'), {
        userId: uid,
        title: 'Account Provisioned',
        message: `Your ${newUserForm.role} account has been pre-approved by the Super Admin.`,
        type: 'system',
        read: false,
        createdAt: serverTimestamp(),
      });
      showToast(`Created approved ${newUserForm.role} credentials for ${createdUser.email}`, 'success');
      setShowCreateUser(false);
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'organizer',
        phone: '',
        college: '',
        course: '',
        organisation: '',
        vendorName: '',
        upiId: '',
      });
    } catch (err: any) {
      const msg =
        err?.code === 'auth/operation-not-allowed'
          ? 'Enable Email/Password sign-in in Firebase Console Authentication to provision password credentials.'
          : err?.code === 'auth/email-already-in-use'
            ? 'That email already has a Firebase Auth account.'
            : err?.message || 'Failed to provision credentials';
      showToast(msg, 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleEventStatusChange = async (event: Event, status: Event['status']) => {
    try {
      await updateDoc(doc(db, 'events', event.id), { status, updatedAt: new Date().toISOString() });
      showToast(`Event "${event.title}" set to ${status}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update event status', 'error');
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    const ok = await confirm({
      title: 'Delete Event',
      message: `Permanently delete "${event.title}"? This action cannot be undone.`,
      confirmText: 'Delete Event',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      showToast('Event deleted.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete event', 'error');
    }
  };

  // Super Admin Registration Verification & Check-in Controls
  const handleVerifyRegistration = async (reg: Registration) => {
    const ev = eventMap[reg.eventId];
    try {
      const ticketId = reg.ticketId || `TKT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const validationToken =
        reg.validationToken || Math.random().toString(36).substring(2, 15);
      const qrCode = `attendance:${reg.eventId}:${reg.userId}:${validationToken}`;

      await updateDoc(doc(db, 'registrations', reg.id), {
        status: 'confirmed',
        ticketId,
        qrCode,
        validationToken,
      });

      if (ev && reg.status !== 'confirmed') {
        await updateDoc(doc(db, 'events', ev.id), {
          registeredCount: increment(1),
        });
      }

      await addDoc(collection(db, 'notifications'), {
        userId: reg.userId,
        title: 'Registration Confirmed',
        message: `Your registration for "${ev?.title || 'Event'}" has been verified by Super Admin. Your QR Pass is ready!`,
        type: 'registration_success',
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast('Registration verified & ticket issued.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to verify registration', 'error');
    }
  };

  const handleRejectRegistration = async (reg: Registration) => {
    const ev = eventMap[reg.eventId];
    const student = userMap[reg.userId];
    const ok = await confirm({
      title: 'Reject Registration?',
      message: `Mark registration for ${student?.name || reg.userName || reg.userId} as rejected?`,
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;

    try {
      const wasConfirmed = reg.status === 'confirmed';
      await updateDoc(doc(db, 'registrations', reg.id), {
        status: 'rejected',
      });
      if (wasConfirmed && ev && (ev.registeredCount || 0) > 0) {
        await updateDoc(doc(db, 'events', ev.id), {
          registeredCount: Math.max(0, (ev.registeredCount || 1) - 1),
        });
      }
      await addDoc(collection(db, 'notifications'), {
        userId: reg.userId,
        title: 'Registration Rejected',
        message: `Your registration for "${ev?.title || 'Event'}" was rejected by Super Admin.`,
        type: 'payment_update',
        read: false,
        createdAt: serverTimestamp(),
      });
      showToast('Registration marked as rejected.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reject registration', 'error');
    }
  };

  const handleMarkRegAttended = async (reg: Registration) => {
    if (!user || reg.attended) return;
    const ev = eventMap[reg.eventId];
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'registrations', reg.id), {
        attended: true,
        scannedAt: nowIso,
        couponActive: ev?.hasFoodCoupon ?? true,
      });

      await setDoc(doc(db, 'attendance', `${reg.userId}_${reg.eventId}`), {
        userId: reg.userId,
        eventId: reg.eventId,
        scanTime: nowIso,
        verifiedBy: user.uid,
      });

      await updateDoc(doc(db, 'users', reg.userId), {
        points: increment(50),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: reg.userId,
        title: 'Checked In (+50 Points)',
        message: `Your attendance for "${ev?.title || 'Event'}" was recorded.${
          ev?.hasFoodCoupon ? ' Your Food Coupon QR is now unlocked!' : ''
        }`,
        type: 'attendance',
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast('Marked attended & awarded +50 Campus Points.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to mark attendance', 'error');
    }
  };

  const handleDeleteRegistration = async (reg: Registration) => {
    const ev = eventMap[reg.eventId];
    const student = userMap[reg.userId];
    const ok = await confirm({
      title: 'Delete Registration?',
      message: `Remove pass for ${student?.name || reg.userName || reg.userId} (${ev?.title || reg.eventId})?`,
      confirmText: 'Delete Pass',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'registrations', reg.id));
      if (reg.status === 'confirmed' && ev && (ev.registeredCount || 0) > 0) {
        await updateDoc(doc(db, 'events', ev.id), {
          registeredCount: Math.max(0, (ev.registeredCount || 1) - 1),
        });
      }
      showToast('Registration deleted.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete registration', 'error');
    }
  };

  const handleDeleteSociety = async (soc: Society) => {
    const ok = await confirm({
      title: 'Delete Society',
      message: `Permanently delete society "${soc.name}"?`,
      confirmText: 'Delete Society',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'societies', soc.id));
      if (soc.organizerId && userMap[soc.organizerId]?.societyId === soc.id) {
        await updateDoc(doc(db, 'users', soc.organizerId), { societyId: '' });
      }
      showToast(`Deleted society ${soc.name}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete society', 'error');
    }
  };

  const handlePaymentAction = async (payment: CanteenPayment, nextStatus: CanteenPayment['status']) => {
    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        status: nextStatus,
        ...(nextStatus === 'paid' ? { paidAt: new Date().toISOString() } : {}),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: payment.vendorId,
        title: `Payout ${nextStatus.toUpperCase()}`,
        message: `Your canteen payout of ₹${payment.amount} for "${payment.eventTitle}" is now ${nextStatus}.`,
        type: 'payment',
        read: false,
        createdAt: serverTimestamp(),
      });
      if (payment.organizerId && payment.organizerId !== payment.vendorId) {
        await addDoc(collection(db, 'notifications'), {
          userId: payment.organizerId,
          title: `Canteen Payout ${nextStatus.toUpperCase()}`,
          message: `Payout of ₹${payment.amount} for "${payment.eventTitle}" was marked ${nextStatus} by Super Admin.`,
          type: 'payment_update',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      showToast(`Payout updated to ${nextStatus}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update payout', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'platform'), settingsForm, { merge: true });
      showToast('Platform settings saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSyncSheets = async () => {
    setSyncing(true);
    try {
      const result = await syncToSheetsAndDrive(
        { action: 'setup' },
        settingsForm.appsScriptUrl || platformSettings.appsScriptUrl
      );
      if (result?.success) {
        showToast('Google Sheets & Drive synchronized successfully.', 'success');
      } else {
        throw new Error(result?.error || 'Sync could not complete');
      }
    } catch (err: any) {
      showToast(err?.message || 'Google Sheets sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const pendingRegPayments = registrations.filter((r) => r.status === 'pending').length;
  const confirmedRegsCount = registrations.filter((r) => r.status === 'confirmed').length;
  const attendedRegsCount = registrations.filter((r) => r.attended).length;
  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.organisation || u.vendorName || u.college || '').toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (u.status || 'pending') === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredEvents = events.filter((ev) => {
    const q = eventSearch.toLowerCase();
    const org = userMap[ev.organizerId];
    const soc = (ev.societyId && societyMap[ev.societyId]) || societyByOrganizer[ev.organizerId];
    const matchesSearch =
      ev.title.toLowerCase().includes(q) ||
      ev.venue.toLowerCase().includes(q) ||
      ev.category.toLowerCase().includes(q) ||
      (org?.name || '').toLowerCase().includes(q) ||
      (soc?.name || '').toLowerCase().includes(q);
    const matchesStatus = eventStatusFilter === 'all' || ev.status === eventStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredRegistrations = registrations.filter((r) => {
    const q = regSearch.toLowerCase();
    const student = userMap[r.userId];
    const ev = eventMap[r.eventId];
    const matchesSearch =
      (student?.name || r.userName || '').toLowerCase().includes(q) ||
      (student?.email || r.userEmail || '').toLowerCase().includes(q) ||
      (ev?.title || '').toLowerCase().includes(q) ||
      (r.ticketId || '').toLowerCase().includes(q) ||
      (r.transactionId || '').toLowerCase().includes(q);
    const matchesFilter =
      regFilter === 'all' ||
      (regFilter === 'attended' && r.attended) ||
      (regFilter === 'coupon_redeemed' && r.couponRedeemed) ||
      r.status === regFilter;
    return matchesSearch && matchesFilter;
  });

  const COLORS = ['#2563eb', '#d97706', '#16a34a', '#7c3aed', '#0891b2'];
  const roleDistribution = [
    { name: 'Students', value: users.filter((u) => u.role === 'student').length },
    { name: 'Organisers', value: users.filter((u) => u.role === 'organizer').length },
    { name: 'Canteen', value: users.filter((u) => u.role === 'canteen').length },
    { name: 'Admins', value: users.filter((u) => u.role === 'admin').length },
  ].filter((d) => d.value > 0);

  const eventCategoryBars = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Academic'].map((cat) => ({
    name: cat,
    count: events.filter((e) => e.category === cat).length,
  }));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary mb-1">Super Admin Console</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Platform Administration</h1>
          <p className="text-secondary text-sm mt-1">
            Real-time sync across all Students, Organisers, Societies, Events, Passes & Canteen Payouts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setShowCreateUser(true)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <UserPlus size={16} /> Provision User
          </button>
          <button
            onClick={handleSyncSheets}
            disabled={syncing}
            className="px-4 py-2.5 rounded-xl glass text-xs sm:text-sm font-semibold flex items-center gap-2 hover:bg-secondary/10 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Sheets'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex gap-1.5 p-1 rounded-2xl glass mb-8 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'users', label: `Users (${users.length}${pendingUsers.length ? ` · ${pendingUsers.length} pending` : ''})`, icon: Users },
            { id: 'events', label: `Events (${events.length})`, icon: Calendar },
            { id: 'registrations', label: `Passes (${registrations.length})`, icon: Ticket },
            { id: 'societies', label: `Societies (${societies.length})`, icon: Building2 },
            { id: 'payments', label: `Payouts (${payments.length})`, icon: CreditCard },
            { id: 'settings', label: 'Settings', icon: Settings },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-foreground'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium text-secondary mb-2">Total Profiles</p>
              <p className="text-3xl font-extrabold tabular-nums">{users.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium text-amber-500 mb-2">Pending Users</p>
              <p className="text-3xl font-extrabold tabular-nums text-amber-500">{pendingUsers.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium text-secondary mb-2">Campus Events</p>
              <p className="text-3xl font-extrabold tabular-nums">{events.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium text-secondary mb-2">Event Passes</p>
              <p className="text-3xl font-extrabold tabular-nums">{registrations.length}</p>
              <p className="text-[11px] text-secondary mt-1 tabular-nums">
                {confirmedRegsCount} confirmed · {attendedRegsCount} attended
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium text-secondary mb-2">Societies</p>
              <p className="text-3xl font-extrabold tabular-nums">{societies.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium text-secondary mb-2">Payout Volume</p>
              <p className="text-3xl font-extrabold tabular-nums">
                ₹{payments.reduce((acc, p) => acc + (p.amount || 0), 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-secondary mt-1 tabular-nums">
                {pendingPaymentsCount} pending requests
              </p>
            </div>
          </div>

          {pendingRegPayments > 0 && (
            <div className="glass rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Ticket size={18} className="text-amber-500 shrink-0" />
                <p className="text-sm font-semibold">
                  {pendingRegPayments} student registration{pendingRegPayments > 1 ? 's' : ''} awaiting payment verification
                </p>
              </div>
              <button
                onClick={() => {
                  setRegFilter('pending');
                  setActiveTab('registrations');
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:opacity-90"
              >
                Review Passes
              </button>
            </div>
          )}

          {/* Pending Approvals Quick Queue */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Pending Credential Approvals</h2>
                <p className="text-xs text-secondary">Review new Student, Organiser, and Canteen accounts awaiting access.</p>
              </div>
              {pendingUsers.length > 0 && (
                <button
                  onClick={() => {
                    setStatusFilter('pending');
                    setActiveTab('users');
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all in Users
                </button>
              )}
            </div>

            {pendingUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-secondary border border-dashed border-border-subtle rounded-xl">
                All registered profiles have been reviewed. No pending requests.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {pendingUsers.slice(0, 6).map((u) => (
                  <div key={u.uid} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {getInitials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{u.name}</p>
                        <p className="text-xs text-secondary truncate">
                          {u.email} · <span className="capitalize font-medium text-foreground">{u.role}</span>
                          {(u.organisation || u.vendorName || u.college) && ` · ${u.organisation || u.vendorName || u.college}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateUserStatus(u, 'approved')}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleUpdateUserStatus(u, 'rejected')}
                        className="px-3.5 py-2 rounded-lg bg-red-600/10 text-red-500 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-600 hover:text-white transition-colors"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass rounded-2xl p-6">
              <h3 className="text-sm font-bold mb-6">Events by Category</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventCategoryBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="text-sm font-bold mb-6">Profile Breakdown</h3>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={4} dataKey="value">
                      {roleDistribution.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {roleDistribution.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between px-2 py-1 rounded-lg bg-background/60">
                    <span className="text-secondary flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {r.name}
                    </span>
                    <span className="font-bold tabular-nums">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 glass rounded-xl px-4 flex items-center gap-3">
              <Search size={18} className="text-secondary shrink-0" />
              <input
                type="text"
                placeholder="Search by name, email, society, or vendor..."
                className="bg-transparent border-none outline-none w-full h-11 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="glass rounded-xl px-4 h-11 text-sm font-medium outline-none"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="organizer">Organisers</option>
              <option value="canteen">Canteen Vendors</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="glass rounded-xl px-4 h-11 text-sm font-medium outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-xs font-semibold text-secondary">
                    <th className="py-3.5 px-4">User Profile</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Connected Activity</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-sm">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-secondary">
                        No user profiles match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const userRegs = regsByUser[u.uid] || [];
                      const orgSoc = (u.societyId && societyMap[u.societyId]) || societyByOrganizer[u.uid];
                      const orgEvents = eventsByOrganizer[u.uid] || [];
                      const vendorPays = paymentsByVendor[u.uid] || [];

                      return (
                        <tr key={u.uid} className="hover:bg-secondary/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  getInitials(u.name)
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate max-w-[180px]">{u.name}</p>
                                <p className="text-xs text-secondary truncate max-w-[200px]">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 capitalize font-medium">
                            {u.role === 'organizer' ? 'Organiser' : u.role}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-secondary">
                            {u.role === 'student' && (
                              <div>
                                <p className="text-foreground font-medium">
                                  {userRegs.length} passes · {u.points || 0} pts
                                </p>
                                <p>{[u.college, u.course].filter(Boolean).join(' · ') || u.phone || '—'}</p>
                              </div>
                            )}
                            {u.role === 'organizer' && (
                              <div>
                                <p className="text-foreground font-medium">
                                  {orgSoc ? orgSoc.name : u.organisation || 'No society linked'}
                                </p>
                                <p>{orgEvents.length} events hosted</p>
                              </div>
                            )}
                            {u.role === 'canteen' && (
                              <div>
                                <p className="text-foreground font-medium">{u.vendorName || u.name}</p>
                                <p className="font-mono">
                                  {u.upiId || 'No UPI'} · {vendorPays.length} payouts
                                </p>
                              </div>
                            )}
                            {u.role === 'admin' && (
                              <div>
                                <p className="text-foreground font-medium">Super Admin Access</p>
                                <p>{u.phone || 'Full platform governance'}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${
                                u.status === 'approved'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : u.status === 'rejected' || u.status === 'suspended'
                                    ? 'text-red-500'
                                    : 'text-amber-500'
                              }`}
                            >
                              {u.status === 'approved' ? (
                                <CheckCircle size={13} />
                              ) : u.status === 'pending' ? (
                                <Clock size={13} />
                              ) : (
                                <XCircle size={13} />
                              )}
                              {u.status || 'pending'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {u.status !== 'approved' && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u, 'approved')}
                                  title="Approve user"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:opacity-90"
                                >
                                  Approve
                                </button>
                              )}
                              {u.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u, 'rejected')}
                                  title="Reject user"
                                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-semibold hover:bg-red-500 hover:text-white transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                              <button
                                onClick={() => setEditingUser(u)}
                                title="Edit user & role"
                                className="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center text-secondary hover:text-primary transition-colors"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                title="Delete user"
                                className="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center text-secondary hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 glass rounded-xl px-4 flex items-center gap-3">
              <Search size={18} className="text-secondary shrink-0" />
              <input
                type="text"
                placeholder="Search events by title, venue, organiser, or society..."
                className="bg-transparent border-none outline-none w-full h-11 text-sm"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
              />
            </div>
            <select
              value={eventStatusFilter}
              onChange={(e) => setEventStatusFilter(e.target.value as any)}
              className="glass rounded-xl px-4 h-11 text-sm font-medium outline-none"
            >
              <option value="all">All Event Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.length === 0 ? (
              <div className="col-span-full glass rounded-2xl p-12 text-center text-secondary">
                No events match your filters.
              </div>
            ) : (
              filteredEvents.map((event) => {
                const org = userMap[event.organizerId];
                const soc = (event.societyId && societyMap[event.societyId]) || societyByOrganizer[event.organizerId];
                const eventRegs = regsByEvent[event.id] || [];
                const confirmed = eventRegs.filter((r) => r.status === 'confirmed').length;
                const pending = eventRegs.filter((r) => r.status === 'pending').length;
                const attended = eventRegs.filter((r) => r.attended).length;
                const redeemed = eventRegs.filter((r) => r.couponRedeemed).length;

                return (
                  <div key={event.id} className="glass rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-base line-clamp-1">{event.title}</h4>
                        <span className="text-xs font-semibold capitalize text-primary shrink-0">{event.status}</span>
                      </div>
                      <p className="text-xs text-secondary mb-2">
                        {event.category} · {event.date ? format(new Date(event.date), 'dd MMM yyyy') : 'TBA'} · {event.venue}
                      </p>
                      <div className="text-xs text-secondary space-y-1 mb-3 p-3 rounded-xl bg-background/60 border border-border-subtle">
                        <p className="truncate">
                          <span className="font-semibold text-foreground">Organiser:</span>{' '}
                          {org ? `${org.name} (${org.email})` : event.organizerId}
                        </p>
                        {soc && (
                          <button
                            type="button"
                            onClick={() => navigate(`/society/${soc.id}`)}
                            className="text-primary font-semibold hover:underline flex items-center gap-1"
                          >
                            {soc.name} <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-medium tabular-nums">
                        <span>
                          {confirmed} / {event.registrationLimit} confirmed
                        </span>
                        <span>· {attended} attended</span>
                        {event.hasFoodCoupon && <span>· {redeemed} meals</span>}
                        {pending > 0 && <span className="text-amber-500 font-semibold">· {pending} pending</span>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                      <select
                        value={event.status}
                        onChange={(e) => handleEventStatusChange(event, e.target.value as Event['status'])}
                        className="bg-background border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/manage/${event.id}`)}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event)}
                          className="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center text-red-500 hover:bg-red-500/10"
                          aria-label="Delete event"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* REGISTRATIONS / PASSES TAB */}
      {activeTab === 'registrations' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 glass rounded-xl px-4 flex items-center gap-3">
              <Search size={18} className="text-secondary shrink-0" />
              <input
                type="text"
                placeholder="Search student, email, event, ticket ID, or TXN ID..."
                className="bg-transparent border-none outline-none w-full h-11 text-sm"
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
              />
            </div>
            <select
              value={regFilter}
              onChange={(e) => setRegFilter(e.target.value as any)}
              className="glass rounded-xl px-4 h-11 text-sm font-medium outline-none"
            >
              <option value="all">All Passes</option>
              <option value="pending">Pending Verification</option>
              <option value="confirmed">Confirmed</option>
              <option value="attended">Checked In</option>
              <option value="coupon_redeemed">Meal Redeemed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-xs font-semibold text-secondary">
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Event & Pass</th>
                    <th className="py-3.5 px-4">Payment / Proof</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-sm">
                  {filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-secondary">
                        No event registrations found.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((reg) => {
                      const student = userMap[reg.userId];
                      const ev = eventMap[reg.eventId];
                      return (
                        <tr key={reg.id} className="hover:bg-secondary/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold">{student?.name || reg.userName || 'Student'}</p>
                            <p className="text-xs text-secondary">{student?.email || reg.userEmail || reg.userId}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-sm">{ev?.title || reg.eventId}</p>
                            <p className="text-xs font-mono text-secondary">{reg.ticketId || 'Ticket Pending'}</p>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              {reg.transactionId && (
                                <span className="font-mono text-secondary">TXN: {reg.transactionId}</span>
                              )}
                              {reg.paymentScreenshot && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewProof({
                                      title: `Payment Proof · ${student?.name || reg.userName || 'Student'}`,
                                      subtitle: `${ev?.title || 'Event'} · TXN: ${reg.transactionId || 'N/A'}`,
                                      src: reg.paymentScreenshot!,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold flex items-center gap-1 hover:bg-primary hover:text-white transition-colors"
                                >
                                  <ImageIcon size={12} /> View Proof
                                </button>
                              )}
                              {!reg.transactionId && !reg.paymentScreenshot && (
                                <span className="text-secondary">{ev?.type === 'paid' ? 'Paid Event' : 'Free Pass'}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 text-xs font-semibold">
                              <span
                                className={`capitalize ${
                                  reg.status === 'confirmed'
                                    ? 'text-emerald-500'
                                    : reg.status === 'rejected'
                                      ? 'text-red-500'
                                      : 'text-amber-500'
                                }`}
                              >
                                {reg.status}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] font-medium text-secondary">
                                <span>{reg.attended ? 'Attended' : 'Not Checked In'}</span>
                                {ev?.hasFoodCoupon && (
                                  <span className={reg.couponRedeemed ? 'text-emerald-500 flex items-center gap-0.5' : ''}>
                                    · <Coffee size={10} /> {reg.couponRedeemed ? 'Meal Redeemed' : 'Meal Ready'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {reg.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleVerifyRegistration(reg)}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:opacity-90"
                                  >
                                    Verify
                                  </button>
                                  <button
                                    onClick={() => handleRejectRegistration(reg)}
                                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-semibold hover:bg-red-500 hover:text-white"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {reg.status === 'confirmed' && !reg.attended && (
                                <button
                                  onClick={() => handleMarkRegAttended(reg)}
                                  className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white"
                                >
                                  Check In
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRegistration(reg)}
                                title="Delete registration"
                                className="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center text-secondary hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SOCIETIES TAB */}
      {activeTab === 'societies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {societies.length === 0 ? (
            <div className="col-span-full glass rounded-2xl p-12 text-center text-secondary">
              No campus societies created yet.
            </div>
          ) : (
            societies.map((soc) => {
              const owner = userMap[soc.organizerId];
              const hostedCount = (eventsByOrganizer[soc.organizerId] || []).length;
              return (
                <div key={soc.id} className="glass rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center overflow-hidden shrink-0">
                        {soc.logoUrl ? (
                          <img src={soc.logoUrl} alt={soc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          getInitials(soc.name)
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-base truncate">{soc.name}</h4>
                        <p className="text-xs text-primary font-semibold">{soc.category} Society</p>
                      </div>
                    </div>
                    <p className="text-xs text-secondary line-clamp-2 mb-3">{soc.description}</p>
                    <div className="text-xs text-secondary p-3 rounded-xl bg-background/60 border border-border-subtle space-y-1">
                      <p className="truncate">
                        <span className="font-semibold text-foreground">Organiser:</span>{' '}
                        {owner ? `${owner.name} (${owner.email})` : soc.organizerId}
                      </p>
                      <p className="tabular-nums">
                        {soc.followerCount || 0} followers · {hostedCount} events hosted
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigate(`/society/${soc.id}`)}
                      className="px-3.5 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      View Society <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteSociety(soc)}
                      className="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center text-red-500 hover:bg-red-500/10"
                      aria-label="Delete society"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {payments.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-secondary">
              No canteen payout requests submitted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {payments.map((payment) => {
                const org = userMap[payment.organizerId];
                const vendor = userMap[payment.vendorId];
                const ev = eventMap[payment.eventId];
                return (
                  <div key={payment.id} className="glass rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="font-bold text-sm">{ev?.title || payment.eventTitle}</h4>
                        <span
                          className={`text-xs font-semibold capitalize ${
                            payment.status === 'paid'
                              ? 'text-emerald-500'
                              : payment.status === 'rejected'
                                ? 'text-red-500'
                                : payment.status === 'approved'
                                  ? 'text-blue-500'
                                  : 'text-amber-500'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                      <p className="text-lg font-extrabold tabular-nums">₹{(payment.amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-secondary mt-1">
                        {payment.studentCount} coupons · Requested{' '}
                        {payment.requestedAt ? format(new Date(payment.requestedAt), 'dd MMM yyyy') : 'Recently'}
                      </p>
                      <div className="text-xs text-secondary mt-2.5 p-2.5 rounded-xl bg-background/60 border border-border-subtle space-y-1">
                        <p className="truncate">
                          <span className="font-semibold text-foreground">Vendor:</span>{' '}
                          {vendor?.vendorName || vendor?.name || payment.vendorId}
                        </p>
                        <p className="truncate">
                          <span className="font-semibold text-foreground">Organiser:</span>{' '}
                          {org?.name || payment.organizerId}
                        </p>
                        {(payment.vendorUpiId || vendor?.upiId) && (
                          <p className="font-mono text-secondary truncate">
                            UPI: {payment.vendorUpiId || vendor?.upiId}
                          </p>
                        )}
                        {payment.upiTransactionId && (
                          <p className="font-mono text-emerald-500 truncate">TXN: {payment.upiTransactionId}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border-subtle flex flex-wrap gap-2">
                      {payment.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handlePaymentAction(payment, 'approved')}
                            className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handlePaymentAction(payment, 'rejected')}
                            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs font-semibold"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {payment.status === 'approved' && (
                        <button
                          onClick={() => handlePaymentAction(payment, 'paid')}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          Mark Paid
                        </button>
                      )}
                      {payment.paymentScreenshot && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewProof({
                              title: `Canteen Settlement · ${ev?.title || payment.eventTitle}`,
                              subtitle: `Vendor: ${vendor?.vendorName || vendor?.name || 'Canteen'} · TXN: ${
                                payment.upiTransactionId || 'N/A'
                              }`,
                              src: payment.paymentScreenshot!,
                            })
                          }
                          className="px-3 py-2 rounded-lg border border-border-subtle text-xs font-semibold flex items-center gap-1 hover:border-primary"
                        >
                          <ImageIcon size={12} /> Proof
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl glass rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-1">Approval & Platform Controls</h2>
            <p className="text-xs text-secondary">Control onboarding approval rules and campus payment defaults.</p>
          </div>

          <div className="space-y-4">
            {(
              [
                { key: 'requireStudentApproval', label: 'Require Super Admin approval for new Students' },
                { key: 'requireOrganizerApproval', label: 'Require Super Admin approval for new Organisers' },
                { key: 'requireCanteenApproval', label: 'Require Super Admin approval for new Canteen Vendors' },
              ] as const
            ).map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-background border border-border-subtle cursor-pointer">
                <span className="text-sm font-medium">{item.label}</span>
                <input
                  type="checkbox"
                  checked={settingsForm[item.key]}
                  onChange={(e) => setSettingsForm({ ...settingsForm, [item.key]: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1.5">Platform Default UPI ID</label>
              <input
                type="text"
                value={settingsForm.platformUpiId}
                onChange={(e) => setSettingsForm({ ...settingsForm, platformUpiId: e.target.value })}
                className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1.5">Support Contact Email</label>
              <input
                type="email"
                value={settingsForm.supportEmail}
                onChange={(e) => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-secondary block mb-1.5">
              Google Apps Script Web App URL (/exec) — Optional for GitHub Pages Direct Sync
            </label>
            <input
              type="url"
              value={settingsForm.appsScriptUrl || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, appsScriptUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3.5 text-sm font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {savingSettings ? 'Saving...' : 'Save Platform Settings'}
          </button>
        </form>
      )}

      {/* PROVISION USER MODAL */}
      {showCreateUser && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateUser(false)} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Provision Approved User</h2>
              <button onClick={() => setShowCreateUser(false)} className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleProvisionUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                >
                  <option value="student">Student</option>
                  <option value="organizer">Organiser</option>
                  <option value="canteen">Canteen Vendor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Phone</label>
                <input
                  type="tel"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                />
              </div>
              {newUserForm.role === 'student' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">College</label>
                    <input
                      type="text"
                      value={newUserForm.college}
                      onChange={(e) => setNewUserForm({ ...newUserForm, college: e.target.value })}
                      className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">Course</label>
                    <input
                      type="text"
                      value={newUserForm.course}
                      onChange={(e) => setNewUserForm({ ...newUserForm, course: e.target.value })}
                      className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                    />
                  </div>
                </div>
              )}
              {newUserForm.role === 'organizer' && (
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Organisation / Society</label>
                  <input
                    type="text"
                    value={newUserForm.organisation}
                    onChange={(e) => setNewUserForm({ ...newUserForm, organisation: e.target.value })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
              )}
              {newUserForm.role === 'canteen' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">Vendor Name</label>
                    <input
                      type="text"
                      value={newUserForm.vendorName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, vendorName: e.target.value })}
                      className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">UPI ID</label>
                    <input
                      type="text"
                      value={newUserForm.upiId}
                      onChange={(e) => setNewUserForm({ ...newUserForm, upiId: e.target.value })}
                      className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                    />
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={creatingUser}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 mt-2"
              >
                {creatingUser ? 'Provisioning...' : 'Create Approved Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit User & Permissions</h2>
              <button onClick={() => setEditingUser(null)} className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditedUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  >
                    <option value="student">Student</option>
                    <option value="organizer">Organiser</option>
                    <option value="canteen">Canteen</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Status</label>
                  <select
                    value={editingUser.status || 'pending'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as UserStatus })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Campus Points</label>
                  <input
                    type="number"
                    min={0}
                    value={editingUser.points || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, points: Number(e.target.value) })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">College</label>
                  <input
                    type="text"
                    value={editingUser.college || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, college: e.target.value })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Course</label>
                  <input
                    type="text"
                    value={editingUser.course || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, course: e.target.value })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Organisation</label>
                  <input
                    type="text"
                    value={editingUser.organisation || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, organisation: e.target.value })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Canteen Vendor Name</label>
                  <input
                    type="text"
                    value={editingUser.vendorName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, vendorName: e.target.value })}
                    className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">UPI ID</label>
                <input
                  type="text"
                  value={editingUser.upiId || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, upiId: e.target.value })}
                  placeholder="vendor@upi"
                  className="w-full bg-background border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={savingUser}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 mt-2"
              >
                {savingUser ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP PROOF LIGHTBOX MODAL */}
      {previewProof && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPreviewProof(null)} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg glass rounded-3xl p-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold truncate">{previewProof.title}</h3>
                {previewProof.subtitle && (
                  <p className="text-xs text-secondary truncate">{previewProof.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewProof(null)}
                className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center shrink-0"
                aria-label="Close proof preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black/40 border border-border-subtle max-h-[70dvh] flex items-center justify-center">
              <img
                src={previewProof.src}
                alt={previewProof.title}
                className="max-h-[68dvh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
