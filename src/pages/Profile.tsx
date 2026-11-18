import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Event, Registration } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Award,
  LogOut,
  Settings,
  ChevronRight,
  CheckCircle,
  Star,
  Bell,
  Shield,
  Users,
  Utensils,
  Calendar,
  Camera,
  X,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { compressImageToDataUrl, getInitials } from '../lib/media';
import { PWAInstallButton } from '../components/PWAInstallButton';

const INTEREST_OPTIONS = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Academic'];

export default function Profile() {
  const { user, logout, isAdmin, isOrganizer, isCanteen } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [attendedEvents, setAttendedEvents] = useState<Event[]>([]);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState({
    eventReminders: true,
    paymentUpdates: true,
    certificates: true,
    societyAnnouncements: true,
  });

  // Edit profile modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    college: '',
    course: '',
    organisation: '',
    vendorName: '',
    upiId: '',
    photoURL: '',
    interests: [] as string[],
  });

  useEffect(() => {
    if (!user) return;
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      college: user.college || '',
      course: user.course || '',
      organisation: user.organisation || '',
      vendorName: user.vendorName || '',
      upiId: user.upiId || '',
      photoURL: user.photoURL || '',
      interests: user.interests || [],
    });
    if (user.notificationPreferences) {
      setNotifPrefs({
        eventReminders: user.notificationPreferences.eventReminders ?? true,
        paymentUpdates: user.notificationPreferences.paymentUpdates ?? true,
        certificates: user.notificationPreferences.certificates ?? true,
        societyAnnouncements: user.notificationPreferences.societyAnnouncements ?? true,
      });
    }

    const fetchAttended = async () => {
      try {
        const q = query(collection(db, 'registrations'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        setTotalRegistered(snapshot.size);

        const attendedRegs = snapshot.docs
          .map((d) => d.data() as Registration)
          .filter((r) => r.attended);

        const events = await Promise.all(
          attendedRegs.map(async (reg) => {
            const eventDoc = await getDoc(doc(db, 'events', reg.eventId));
            return eventDoc.exists() ? ({ id: eventDoc.id, ...eventDoc.data() } as Event) : null;
          })
        );
        setAttendedEvents(events.filter((e): e is Event => Boolean(e)));
      } catch (err) {
        console.error('Fetch attended error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttended();
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 400, 0.72);
      setEditForm((prev) => ({ ...prev, photoURL: dataUrl }));
      showToast('Profile photo ready to save.', 'info');
    } catch {
      showToast('Could not process selected photo.', 'error');
    }
  };

  const toggleInterest = (interest: string) => {
    setEditForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editForm.name.trim()) {
      showToast('Display name cannot be empty.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        college: editForm.college.trim(),
        course: editForm.course.trim(),
        organisation: editForm.organisation.trim(),
        vendorName: editForm.vendorName.trim(),
        upiId: editForm.upiId.trim(),
        photoURL: editForm.photoURL,
        interests: editForm.interests,
        updatedAt: new Date().toISOString(),
      });
      setShowEditModal(false);
      showToast('Profile updated!', 'success');
    } catch (err) {
      console.error('Save profile error:', err);
      showToast('Failed to save profile changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const level = Math.max(1, Math.floor((user.points || 0) / 100) + 1);

  const achievements = [
    { name: 'Member', unlocked: true },
    { name: 'First Event', unlocked: totalRegistered >= 1 },
    { name: 'Checked In', unlocked: attendedEvents.length >= 1 },
    { name: 'Campus Pro', unlocked: (user.points || 0) >= 200 },
  ];

  const getRoleIcon = () => {
    if (isAdmin) return <Shield size={18} />;
    if (isOrganizer) return <Users size={18} />;
    if (isCanteen) return <Utensils size={18} />;
    return <Award size={18} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full px-4 sm:px-6 pt-5 sm:pt-6 pb-4 max-w-2xl mx-auto"
    >
      <header className="flex justify-between items-center gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Profile</h1>
        <div className="flex gap-2 shrink-0">
          <Link
            to="/notifications"
            className="w-10 h-10 glass border border-border-subtle rounded-full flex items-center justify-center text-secondary hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell size={18} />
          </Link>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 h-10 glass border border-border-subtle rounded-full flex items-center gap-2 text-xs font-bold text-primary hover:border-primary/40 whitespace-nowrap"
          >
            <Settings size={16} />
            Edit Profile
          </button>
        </div>
      </header>

      <div className="text-center mb-8 min-w-0">
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl glass p-1 border border-border-subtle bg-primary/10 flex items-center justify-center overflow-hidden">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                className="w-full h-full object-cover rounded-[1.25rem]"
                alt={user.name}
              />
            ) : (
              <span className="text-3xl font-extrabold text-primary">{getInitials(user.name)}</span>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
            {getRoleIcon()}
          </div>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight break-words">{user.name}</h2>
        <p className="text-secondary text-sm break-all">{user.email}</p>
        {(user.college || user.organisation || user.vendorName) && (
          <p className="text-xs text-secondary mt-1 break-words">
            {user.vendorName || user.organisation || user.college}
            {user.course ? ` · ${user.course}` : ''}
          </p>
        )}

        <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 glass border border-border-subtle rounded-full text-xs font-bold text-primary">
          <Star size={12} className="fill-primary" />
          <span className="capitalize">{user.role === 'organizer' ? 'Organiser' : user.role}</span> · Level {level}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass p-5 rounded-3xl border border-border-subtle text-center">
          <p className="text-2xl font-extrabold text-primary tabular-nums">{user.points || 0}</p>
          <p className="text-xs text-secondary font-semibold uppercase tracking-wider mt-1">
            Campus Points
          </p>
        </div>
        <div className="glass p-5 rounded-3xl border border-border-subtle text-center">
          <p className="text-2xl font-extrabold text-accent tabular-nums">{attendedEvents.length}</p>
          <p className="text-xs text-secondary font-semibold uppercase tracking-wider mt-1">
            Events Attended
          </p>
        </div>
      </div>

      {user.role === 'student' && (
        <>
          <section className="mb-8">
            <h3 className="text-lg font-bold mb-4">Achievements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {achievements.map((badge) => (
                <div
                  key={badge.name}
                  className={`glass rounded-2xl border border-border-subtle flex flex-col items-center justify-center p-4 ${
                    badge.unlocked ? '' : 'opacity-50'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl mb-2.5 flex items-center justify-center ${
                      badge.unlocked
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-secondary/10 text-secondary'
                    }`}
                  >
                    <Award size={20} />
                  </div>
                  <p className="text-xs font-bold text-center">{badge.name}</p>
                  <p className="text-[10px] text-secondary mt-0.5">
                    {badge.unlocked ? 'Unlocked' : 'Locked'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-lg font-bold mb-4">Credentials & Attended Events</h3>
            <Link
              to="/certificates"
              className="glass p-4 rounded-2xl border border-primary/25 flex items-center justify-between hover:border-primary/50 transition-colors mb-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Award size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">My Digital Certificates</h4>
                  <p className="text-xs text-secondary">Download official PDFs and share QR verification links</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-secondary" />
            </Link>
            {loading ? (
              <div className="glass h-20 rounded-2xl animate-pulse" />
            ) : attendedEvents.length > 0 ? (
              <div className="space-y-3">
                {attendedEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.slug || event.id}`}
                    className="glass p-4 rounded-2xl border border-border-subtle flex items-center justify-between hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500 shrink-0">
                        <CheckCircle size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate">{event.title}</h4>
                        <p className="text-xs text-secondary">{event.category}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-secondary shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass p-8 rounded-3xl text-center border border-dashed border-border-subtle">
                <p className="text-secondary text-xs">No attended events yet.</p>
              </div>
            )}
          </section>
        </>
      )}

      {(isOrganizer || isAdmin) && (
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-4">Management</h3>
          <div className="space-y-3">
            <Link
              to="/dashboard"
              className="glass p-4 rounded-2xl border border-border-subtle flex items-center justify-between hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Organiser Hub</h4>
                  <p className="text-xs text-secondary">Manage events and analytics</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-secondary" />
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="glass p-4 rounded-2xl border border-border-subtle flex items-center justify-between hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Super Admin Console</h4>
                    <p className="text-xs text-secondary">Manage users, approvals, and settings</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-secondary" />
              </Link>
            )}
          </div>
        </section>
      )}

      {isCanteen && (
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-4">Canteen Operations</h3>
          <Link
            to="/canteen"
            className="glass p-4 rounded-2xl border border-border-subtle flex items-center justify-between hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Utensils size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Canteen Portal</h4>
                <p className="text-xs text-secondary">Verify food coupons and request payouts</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-secondary" />
          </Link>
        </section>
      )}

      <section className="mb-8 glass rounded-3xl p-5 border border-border-subtle space-y-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Notification Preferences</h3>
        </div>
        {(
          [
            { key: 'eventReminders', label: 'Event schedules, broadcasts & seat promotions' },
            { key: 'paymentUpdates', label: 'Payment confirmations & canteen payout updates' },
            { key: 'certificates', label: 'Digital certificate issuance alerts' },
            { key: 'societyAnnouncements', label: 'Campus society announcements & applications' },
          ] as const
        ).map((pref) => (
          <label
            key={pref.key}
            className="flex items-center justify-between gap-3 py-1.5 text-xs sm:text-sm cursor-pointer"
          >
            <span className="text-secondary">{pref.label}</span>
            <input
              type="checkbox"
              checked={notifPrefs[pref.key]}
              onChange={async (e) => {
                const updated = { ...notifPrefs, [pref.key]: e.target.checked };
                setNotifPrefs(updated);
                try {
                  await updateDoc(doc(db, 'users', user.uid), {
                    notificationPreferences: updated,
                    updatedAt: new Date().toISOString(),
                  });
                  showToast('Notification preference updated.', 'success');
                } catch {
                  showToast('Could not save preference.', 'error');
                }
              }}
              className="w-4 h-4 accent-primary shrink-0"
            />
          </label>
        ))}
      </section>

      <section className="mb-6">
        <PWAInstallButton variant="card" />
      </section>

      <button
        onClick={handleLogout}
        className="w-full py-3.5 rounded-2xl font-bold text-red-500 glass border border-red-500/20 flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
      >
        <LogOut size={18} />
        Sign Out
      </button>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass rounded-3xl p-6 border border-border-subtle shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Edit Profile</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl hover:bg-secondary/10"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0">
                    {editForm.photoURL ? (
                      <img
                        src={editForm.photoURL}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(editForm.name)
                    )}
                  </div>
                  <label className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-bold cursor-pointer hover:border-primary/40 flex items-center gap-2">
                    <Camera size={14} />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>

                {user.role === 'student' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-secondary block mb-1">
                        College
                      </label>
                      <input
                        type="text"
                        value={editForm.college}
                        onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
                        className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondary block mb-1">
                        Course / Year
                      </label>
                      <input
                        type="text"
                        value={editForm.course}
                        onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                        className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                      />
                    </div>
                  </div>
                )}

                {user.role === 'organizer' && (
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">
                      Organisation / Club Name
                    </label>
                    <input
                      type="text"
                      value={editForm.organisation}
                      onChange={(e) =>
                        setEditForm({ ...editForm, organisation: e.target.value })
                      }
                      className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                    />
                  </div>
                )}

                {user.role === 'canteen' && (
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">
                      Canteen / Vendor Name
                    </label>
                    <input
                      type="text"
                      value={editForm.vendorName}
                      onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                      className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                    />
                  </div>
                )}

                {(user.role === 'organizer' || user.role === 'canteen') && (
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      value={editForm.upiId}
                      onChange={(e) => setEditForm({ ...editForm, upiId: e.target.value })}
                      placeholder="name@upi"
                      className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">
                    Interests
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((tag) => {
                      const active = editForm.interests.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleInterest(tag)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-primary text-white'
                              : 'border border-border-subtle text-secondary hover:text-foreground'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-3 rounded-xl border border-border-subtle text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
