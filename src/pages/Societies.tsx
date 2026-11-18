import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { Building2, Search, Users, ArrowRight, Plus } from 'lucide-react';
import { db } from '../firebase';
import { Society } from '../types';
import { useAuth } from '../context/AuthContext';
import PublicNavbar from '../components/PublicNavbar';
import { useDocumentSeo } from '../lib/seo';
import { getInitials } from '../lib/media';

const CATEGORIES = ['All', 'Technical', 'Cultural', 'Sports', 'Arts', 'Social', 'Academic'];

export default function Societies() {
  const { isOrganizer, isAdmin } = useAuth();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useDocumentSeo({
    title: 'Campus Societies & Student Communities | Campus Connect',
    description:
      'Explore student clubs, technical societies, cultural chapters, faculty coordinators, and campus communities on Campus Connect.',
    canonicalPath: 'societies',
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'societies'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Society, 'id'>) }))
          .filter((s) => s.approvalStatus !== 'rejected');
        list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
        setSocieties(list);
        setLoading(false);
      },
      (err) => {
        console.error('Load societies error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = societies.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q);
    const matchesCat =
      selectedCategory === 'All' ||
      (s.category || '').toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <PublicNavbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              University Clubs & Chapters
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Campus Societies Directory
            </h1>
          </div>

          {(isOrganizer || isAdmin) && (
            <Link
              to="/create-society"
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center gap-2 self-start sm:self-auto hover:opacity-90"
            >
              <Plus size={16} />
              Create Society
            </Link>
          )}
        </div>

        {/* Search & Category Strip */}
        <div className="space-y-3">
          <div className="glass rounded-xl px-3.5 flex items-center gap-2.5 max-w-xl">
            <Search size={16} className="text-secondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search societies, clubs, or departments..."
              className="w-full h-11 bg-transparent text-sm focus:outline-none"
            />
          </div>

          <div className="flex gap-1.5 p-1 glass rounded-xl overflow-x-auto no-scrollbar max-w-full sm:w-fit">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === cat ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass h-56 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((soc) => (
              <Link
                key={soc.id}
                to={`/society/${soc.id}`}
                className="glass rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform group"
              >
                <div>
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                      {soc.logoUrl ? (
                        <img
                          src={soc.logoUrl}
                          alt={soc.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        getInitials(soc.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-primary uppercase tracking-wide truncate">
                        {soc.category}
                      </p>
                      <h2 className="text-base font-bold truncate group-hover:text-primary transition-colors">
                        {soc.name}
                      </h2>
                      {soc.facultyCoordinator?.name && (
                        <p className="text-xs text-secondary truncate">
                          Faculty: {soc.facultyCoordinator.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-secondary line-clamp-3 leading-relaxed">
                    {soc.description || 'Active campus chapter hosting events, workshops, and student engagement programs.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                  <span className="text-secondary flex items-center gap-1.5 tabular-nums">
                    <Users size={14} className="text-primary" />
                    {soc.followerCount || 0} followers
                  </span>
                  <span className="font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Profile
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass rounded-3xl p-12 text-center border-dashed space-y-2">
            <Building2 size={28} className="text-primary mx-auto" />
            <h2 className="text-base font-bold">No societies listed yet</h2>
            <p className="text-xs sm:text-sm text-secondary max-w-md mx-auto">
              Approved campus organisers can register student clubs and technical chapters to appear in this live directory.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
