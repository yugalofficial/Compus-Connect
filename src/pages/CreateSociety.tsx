import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Camera, Globe, Instagram, Twitter } from 'lucide-react';
import { Society } from '../types';
import { compressImageToDataUrl, HERO_BANNER_IMAGE, getInitials } from '../lib/media';

export default function CreateSociety() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Tech',
    logoUrl: '',
    bannerUrl: '',
    socials: {
      website: '',
      instagram: '',
      twitter: '',
    },
  });

  useEffect(() => {
    if (!id) return;
    const fetchSociety = async () => {
      try {
        const socDoc = await getDoc(doc(db, 'societies', id));
        if (socDoc.exists()) {
          const data = socDoc.data() as Society;
          setFormData({
            name: data.name || '',
            description: data.description || '',
            category: data.category || 'Tech',
            logoUrl: data.logoUrl || '',
            bannerUrl: data.bannerUrl || '',
            socials: {
              website: data.socials?.website || '',
              instagram: data.socials?.instagram || '',
              twitter: data.socials?.twitter || '',
            },
          });
        }
      } catch (err) {
        console.error('Fetch society error:', err);
        showToast('Failed to load society profile.', 'error');
      }
    };
    fetchSociety();
  }, [id]);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'bannerUrl' | 'logoUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(
        file,
        field === 'bannerUrl' ? 900 : 380,
        0.72
      );
      setFormData((prev) => ({ ...prev, [field]: dataUrl }));
      showToast(`${field === 'bannerUrl' ? 'Banner' : 'Logo'} updated!`, 'success');
    } catch (err) {
      console.error('Image upload error:', err);
      showToast('Failed to process selected image.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.name.trim() || !formData.description.trim()) {
      showToast('Please enter society name and description.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (id) {
        await updateDoc(doc(db, 'societies', id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        showToast('Society updated!', 'success');
        navigate(`/society/${id}`);
      } else {
        const societyData = {
          ...formData,
          organizerId: user.uid,
          followerCount: 0,
          createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, 'societies'), societyData);
        await updateDoc(doc(db, 'users', user.uid), {
          societyId: docRef.id,
        });
        showToast('Society created!', 'success');
        navigate(`/society/${docRef.id}`);
      }
    } catch (err) {
      console.error('Submit society error:', err);
      showToast('Failed to save society profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full px-4 sm:px-6 pt-5 sm:pt-6 pb-4 max-w-2xl mx-auto"
    >
      <header className="flex items-center gap-3 sm:gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 glass border border-border-subtle rounded-full flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {id ? 'Edit Society' : 'Create Society'}
          </h1>
          <p className="text-xs text-secondary">Brand your student club or campus chapter</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle space-y-6">
          <div className="relative">
            <label className="relative block h-36 bg-secondary/10 rounded-2xl overflow-hidden border border-dashed border-border-subtle cursor-pointer group">
              <img
                src={formData.bannerUrl || HERO_BANNER_IMAGE}
                alt="Society banner"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-85 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="mb-1" />
                <span className="text-xs font-bold">Upload Cover Banner</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, 'bannerUrl')}
              />
            </label>

            <label className="absolute -bottom-7 left-5 w-20 h-20 rounded-2xl glass p-1 border border-border-subtle shadow-lg cursor-pointer overflow-hidden flex items-center justify-center bg-surface group">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Society logo"
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <span className="font-extrabold text-primary text-lg">
                  {getInitials(formData.name || 'CC')}
                </span>
              )}
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={16} />
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, 'logoUrl')}
              />
            </label>
          </div>

          <div className="pt-8">
            <label className="text-xs text-secondary font-semibold mb-1.5 block">
              Society Name
            </label>
            <input
              type="text"
              required
              className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Coding Club"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-secondary font-semibold mb-1.5 block">Category</label>
            <select
              className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
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
              About Society
            </label>
            <textarea
              required
              rows={4}
              className="w-full bg-background/50 border border-border-subtle rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="What does your society organize and build?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border border-border-subtle space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            Social Links (Optional)
          </h3>

          <div className="space-y-3">
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
              <input
                type="url"
                placeholder="https://society.campus.edu"
                className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.socials.website}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socials: { ...formData.socials, website: e.target.value },
                  })
                }
              />
            </div>
            <div className="relative">
              <Instagram className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
              <input
                type="text"
                placeholder="Instagram handle (e.g. codingclub)"
                className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.socials.instagram}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socials: { ...formData.socials, instagram: e.target.value },
                  })
                }
              />
            </div>
            <div className="relative">
              <Twitter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
              <input
                type="text"
                placeholder="X / Twitter handle"
                className="w-full bg-background/50 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.socials.twitter}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socials: { ...formData.socials, twitter: e.target.value },
                  })
                }
              />
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
              {id ? 'Update Society' : 'Create Society'}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
