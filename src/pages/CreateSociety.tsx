import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Camera, Globe, Instagram, Twitter, Plus, Trash2 } from 'lucide-react';
import { Society, SocietyCoreMember } from '../types';
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
    facultyCoordinator: {
      name: '',
      department: '',
      email: '',
    },
    socials: {
      website: '',
      instagram: '',
      twitter: '',
    },
  });
  const [coreTeam, setCoreTeam] = useState<SocietyCoreMember[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);

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
            facultyCoordinator: {
              name: data.facultyCoordinator?.name || '',
              department: data.facultyCoordinator?.department || '',
              email: data.facultyCoordinator?.email || '',
            },
            socials: {
              website: data.socials?.website || '',
              instagram: data.socials?.instagram || '',
              twitter: data.socials?.twitter || '',
            },
          });
          setCoreTeam(Array.isArray(data.coreTeam) ? data.coreTeam : []);
          setGalleryUrls(Array.isArray(data.galleryUrls) ? data.galleryUrls : []);
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
      const cleanTeam = coreTeam.filter((m) => m.name.trim());
      const payload = {
        ...formData,
        coreTeam: cleanTeam,
        galleryUrls,
      };
      if (id) {
        await updateDoc(doc(db, 'societies', id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        showToast('Society updated!', 'success');
        navigate(`/society/${id}`);
      } else {
        const societyData = {
          ...payload,
          organizerId: user.uid,
          followerCount: 0,
          approvalStatus: 'approved' as const,
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

        {/* Faculty Coordinator & Core Team */}
        <div className="glass p-6 rounded-3xl border border-border-subtle space-y-5">
          <div>
            <h3 className="text-sm font-bold">Faculty Coordinator & Leadership</h3>
            <p className="text-xs text-secondary">Displayed on your public society directory profile</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Faculty Coordinator Name"
              className="bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
              value={formData.facultyCoordinator.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  facultyCoordinator: { ...formData.facultyCoordinator, name: e.target.value },
                })
              }
            />
            <input
              type="text"
              placeholder="Department"
              className="bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
              value={formData.facultyCoordinator.department}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  facultyCoordinator: {
                    ...formData.facultyCoordinator,
                    department: e.target.value,
                  },
                })
              }
            />
            <input
              type="email"
              placeholder="Coordinator Email"
              className="bg-background/50 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
              value={formData.facultyCoordinator.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  facultyCoordinator: { ...formData.facultyCoordinator, email: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2.5 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Core Team Members ({coreTeam.length})</span>
              <button
                type="button"
                onClick={() => setCoreTeam((t) => [...t, { name: '', role: '' }])}
                className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
              >
                <Plus size={13} /> Add Member
              </button>
            </div>
            {coreTeam.map((member, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="Student Lead Name"
                  value={member.name}
                  onChange={(e) => {
                    const copy = [...coreTeam];
                    copy[idx] = { ...copy[idx], name: e.target.value };
                    setCoreTeam(copy);
                  }}
                  className="sm:col-span-5 h-9 px-2.5 rounded-lg bg-background/60 border border-border-subtle text-xs"
                />
                <input
                  type="text"
                  placeholder="Role (e.g. President, Technical Lead)"
                  value={member.role}
                  onChange={(e) => {
                    const copy = [...coreTeam];
                    copy[idx] = { ...copy[idx], role: e.target.value };
                    setCoreTeam(copy);
                  }}
                  className="sm:col-span-6 h-9 px-2.5 rounded-lg bg-background/60 border border-border-subtle text-xs"
                />
                <button
                  type="button"
                  onClick={() => setCoreTeam((t) => t.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 h-9 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-lg"
                  aria-label="Remove member"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Highlight Gallery ({galleryUrls.length}/4)</span>
              {galleryUrls.length < 4 && (
                <label className="text-xs font-semibold text-primary cursor-pointer hover:underline">
                  + Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await compressImageToDataUrl(file, 720, 0.72);
                        setGalleryUrls((g) => [...g.slice(0, 3), url]);
                      } catch {
                        showToast('Failed to compress photo.', 'error');
                      }
                    }}
                  />
                </label>
              )}
            </div>
            {galleryUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {galleryUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-border-subtle">
                    <img src={url} alt={`Society gallery ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setGalleryUrls((g) => g.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
