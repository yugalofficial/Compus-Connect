import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  updateDoc,
  doc,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Calendar, Info, CheckCircle2, ArrowLeft, Trash2, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

function getNotifTimestamp(createdAt: any): number {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const t = new Date(createdAt).getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
}

function formatNotifTime(createdAt: any): string {
  const ms = getNotifTimestamp(createdAt);
  if (!ms) return 'Just now';
  return format(new Date(ms), 'dd MMM, HH:mm');
}

export default function Notifications() {
  const { user } = useAuth();
  const { showToast, confirm } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
        list.sort((a, b) => getNotifTimestamp(b.createdAt) - getNotifTimestamp(a.createdAt));
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.error('Notifications listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      await Promise.all(
        unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }))
      );
      showToast('All notifications marked as read.', 'success');
    } catch (err) {
      console.error('Mark all read error:', err);
      showToast('Failed to update notifications.', 'error');
    }
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Clear All Notifications?',
      message: 'This will permanently delete all your notifications.',
      confirmText: 'Clear All',
      destructive: true,
    });
    if (!ok) return;
    try {
      await Promise.all(notifications.map((n) => deleteDoc(doc(db, 'notifications', n.id))));
      showToast('Notifications cleared.', 'info');
    } catch (err) {
      console.error('Clear all error:', err);
      showToast('Failed to clear notifications.', 'error');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'event_update':
        return <Calendar className="text-primary" size={18} />;
      case 'registration_success':
        return <CheckCircle2 className="text-emerald-500" size={18} />;
      default:
        return <Info className="text-accent" size={18} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visibleNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 sm:px-6 pt-6 pb-12 max-w-2xl mx-auto space-y-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 glass border border-border-subtle rounded-full flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Notifications</h1>
            <p className="text-xs text-secondary tabular-nums">
              {unreadCount} unread · {notifications.length} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3.5 py-2 glass border border-border-subtle rounded-xl text-xs font-bold text-primary flex items-center gap-1.5 hover:border-primary/40"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="w-10 h-10 glass border border-border-subtle rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
              aria-label="Clear all notifications"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize ${
              filter === tab
                ? 'bg-primary text-white'
                : 'glass border border-border-subtle text-secondary'
            }`}
          >
            {tab === 'unread' ? `Unread (${unreadCount})` : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-20 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                  className={`glass p-5 rounded-3xl border flex gap-4 cursor-pointer transition-all ${
                    notif.read
                      ? 'border-border-subtle opacity-70'
                      : 'border-primary/40 bg-primary/5'
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-background/60 border border-border-subtle flex items-center justify-center shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-3 mb-1">
                      <h3 className="font-bold text-sm leading-tight flex items-center gap-2">
                        {notif.title}
                        {!notif.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </h3>
                      <span className="text-[11px] text-secondary font-medium tabular-nums shrink-0">
                        {formatNotifTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{notif.message}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16 glass rounded-3xl border border-dashed border-border-subtle">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell size={28} className="text-secondary/40" />
                </div>
                <p className="font-bold text-sm">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </p>
                <p className="text-xs text-secondary mt-1">
                  Event updates, payment confirmations, and approvals appear here.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
