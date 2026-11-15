import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Calendar,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Coffee,
  Camera,
  QrCode,
  Link2,
} from 'lucide-react';
import { compressImageToDataUrl, getEventCover } from '../lib/media';
import { syncToSheetsAndDrive } from '../lib/api';

export default function CreateEvent() {
  const { user, platformSettings } = useAuth();
  const { showToast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    date: '',
    venue: '',
    category: 'Tech',
    type: 'free' as 'free' | 'paid',
    fee: 0,
    upiId: user?.upiId || platformSettings.platformUpiId || '',
    registrationLimit: 100,
    hasFoodCoupon: false,
    couponCost: 50,
    maxCoupons: 100,
    posterUrl: '',
    qrScanStart: '',
    qrScanEnd: '',
  });

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      try {
        const eventDoc = await getDoc(doc(db, 'events', id));
        if (eventDoc.exists()) {
          const data = eventDoc.data() as any;
          setFormData({
            title: data.title || '',
            slug: data.slug || '',
            description: data.description || '',
            date: data.date || '',
            venue: data.venue || '',
            category: data.category || 'Tech',
            type: data.type || 'free',
            fee: data.fee || 0,
            upiId: data.upiId || user?.upiId || '',
            registrationLimit: data.registrationLimit || 100,
            hasFoodCoupon: Boolean(data.hasFoodCoupon),
            couponCost: data.couponCost || 50,
            maxCoupons: data.maxCoupons || data.registrationLimit || 100,
            posterUrl: data.posterUrl || '',
            qrScanStart: data.qrScanStart || '',
            qrScanEnd: data.qrScanEnd || '',
          });
        }
      } catch (err) {
        console.error('Fetch event error:', err);
        showToast('Failed to load event details.', 'error');
      }
    };
    fetchEvent();
  }, [id]);

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.72);
      if (dataUrl.length > 750000) {
        showToast('Image is too large even after compression. Try a smaller image.', 'error');
        return;
      }
      setFormData((prev) => ({ ...prev, posterUrl: dataUrl }));
      showToast('Event poster attached!', 'success');
    } catch (err) {
      console.error('Poster upload error:', err);
      showToast('Invalid image file.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.title.trim() || !formData.date || !formData.venue.trim()) {
      showToast('Please complete title, date, and venue.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        title: formData.title.trim(),
        venue: formData.venue.trim(),
        slug:
          formData.slug.trim() ||
          formData.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        fee: formData.type === 'paid' ? Number(formData.fee) || 0 : 0,
        registrationLimit: Math.max(1, Number(formData.registrationLimit) || 100),
        couponCost: formData.hasFoodCoupon ? Number(formData.couponCost) || 50 : 0,
        maxCoupons: formData.hasFoodCoupon
          ? Number(formData.maxCoupons) || Number(formData.registrationLimit) || 100
          : 0,
      };

      if (id) {
        await updateDoc(doc(db, 'events', id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        showToast('Event updated!', 'success');
        navigate(`/manage/${id}`);
      } else {
        const eventData = {
          ...payload,
          organizerId: user.uid,
          societyId: user.societyId || '',
          registeredCount: 0,
          status: 'upcoming' as const,
          qrVisible: true,
          createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, 'events'), eventData);

        try {
          await syncToSheetsAndDrive(
            {
              action: 'createEvent',
              data: { id: docRef.id, ...eventData, organizerName: user.name },
            },
            platformSettings.appsScriptUrl
          );
        } catch {
          // Sheets sync optional
        }

        showToast('Event published successfully!', 'success');
        navigate(`/manage/${docRef.id}`);
      }
    } catch (err) {
      console.error('Submit event error:', err);
      showToast('Failed to save event. Check permissions or field limits.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 sm:px-6 pt-6 pb-12 max-w-2xl mx-auto"
    >
      <header className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 glass border border-border-subtle rounded-full flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {id ? 'Edit Event' : 'Create Event'}
          </h1>
          <p className="text-xs text-secondary">Configure event details, ticketing, and QR pass rules</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Poster + Core Info */}
        <div className="glass p-6 rounded-3xl border border-border-subtle space-y-5">
          <div>
            <label className="relative block aspect-video rounded-2xl overflow-hidden border border-dashed border-border-subtle cursor-pointer group bg-secondary/5">
              <img
                src={getEventCover(formData.posterUrl, formData.category)}
                alt="Event cover preview"
                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-90 group-hover:opacity-100 transition-opacity">
                <Camera size={28} className="mb-1.5" />
                <span className="text-xs font-bold">
                  {formData.posterUrl ? 'Change Event Poster' : 'Upload Event Poster (or use default cover)'}
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePosterUpload}
              />
            </label>

            <div className="mt-3 flex items-center gap-2">
              <Link2 size={14} className="text-secondary shrink-0" />
              <input
                type="url"
                placeholder="Or paste poster image URL (optional)"
                className="flex-1 bg-background/50 border border-border-subtle rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.posterUrl.startsWith('data:') ? '' : formData.posterUrl}
                onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
              />
              {formData.posterUrl && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, posterUrl: '' })}
                  className="text-xs text-secondary hover:text-foreground font-semibold px-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-secondary font-semibold mb-1.5 block">Event Title</label>
            <input
              type="text"
              required
              className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Annual Hackathon 2026"
              value={formData.title}
              onChange={(e) => {
                const title = e.target.value;
                const slug = title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '');
                setFormData({ ...formData, title, slug });
              }}
            />
          </div>

          <div>
            <label className="text-xs text-secondary font-semibold mb-1.5 block">Event URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary font-mono">/events/</span>
              <input
                type="text"
                required
                className="flex-1 bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary text-xs font-mono"
                placeholder="tech-fest-2026"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                }
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-secondary font-semibold mb-1.5 block">Description</label>
            <textarea
              required
              rows={4}
              className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Describe the agenda, prerequisites, and highlights..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-secondary font-semibold mb-1.5 block">Category</label>
              <select
                className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Tech">Tech</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
                <option value="Workshop">Workshop</option>
                <option value="Academic">Academic</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-secondary font-semibold mb-1.5 block">
                Registration Limit
              </label>
              <input
                type="number"
                min={1}
                required
                className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-3 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.registrationLimit}
                onChange={(e) =>
                  setFormData({ ...formData, registrationLimit: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        {/* Date & Venue */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass p-4 rounded-3xl border border-border-subtle">
            <label className="text-xs text-secondary font-semibold mb-2 block">Date & Time</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary w-4 h-4" />
              <input
                type="datetime-local"
                required
                className="w-full bg-transparent text-sm font-semibold pl-9 focus:outline-none"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>
          <div className="glass p-4 rounded-3xl border border-border-subtle">
            <label className="text-xs text-secondary font-semibold mb-2 block">Venue</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-primary w-4 h-4" />
              <input
                type="text"
                required
                placeholder="Main Auditorium"
                className="w-full bg-transparent text-sm font-semibold pl-9 focus:outline-none"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Pricing, Food Coupon, QR Window */}
        <div className="glass p-6 rounded-3xl border border-border-subtle space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">Registration Fee</p>
                <p className="text-xs text-secondary">Free or paid UPI/Razorpay ticketing</p>
              </div>
            </div>
            <select
              className="bg-background/50 border border-border-subtle rounded-xl px-4 py-2 text-xs font-bold"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as 'free' | 'paid' })
              }
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {formData.type === 'paid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
              <div>
                <label className="text-xs text-secondary font-semibold mb-1.5 block">
                  Fee (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-semibold tabular-nums"
                  value={formData.fee}
                  onChange={(e) => setFormData({ ...formData, fee: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-secondary font-semibold mb-1.5 block">
                  Organiser UPI ID
                </label>
                <input
                  type="text"
                  placeholder="club@upi"
                  className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-mono"
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Coffee size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">Include Food Coupon</p>
                <p className="text-xs text-secondary">Enable canteen QR meal redemption</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, hasFoodCoupon: !formData.hasFoodCoupon })
              }
              className={`w-12 h-6 rounded-full transition-colors relative ${
                formData.hasFoodCoupon ? 'bg-primary' : 'bg-secondary/25'
              }`}
              aria-label="Toggle food coupon"
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  formData.hasFoodCoupon ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {formData.hasFoodCoupon && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
              <div>
                <label className="text-xs text-secondary font-semibold mb-1.5 block">
                  Coupon Value / Student (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-semibold tabular-nums"
                  value={formData.couponCost}
                  onChange={(e) =>
                    setFormData({ ...formData, couponCost: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-secondary font-semibold mb-1.5 block">
                  Max Coupons
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-semibold tabular-nums"
                  value={formData.maxCoupons}
                  onChange={(e) =>
                    setFormData({ ...formData, maxCoupons: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border-subtle space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <QrCode size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">QR Scan Window (Optional)</p>
                <p className="text-xs text-secondary">Attendance check-in schedule</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-secondary font-semibold mb-1 block">Start Time</label>
                <input
                  type="datetime-local"
                  className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-xs font-semibold"
                  value={formData.qrScanStart}
                  onChange={(e) => setFormData({ ...formData, qrScanStart: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-secondary font-semibold mb-1 block">End Time</label>
                <input
                  type="datetime-local"
                  className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-xs font-semibold"
                  value={formData.qrScanEnd}
                  onChange={(e) => setFormData({ ...formData, qrScanEnd: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-primary/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={18} />
              {id ? 'Update Event' : 'Publish Event'}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
