import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Award, Download, ExternalLink, Search, Share2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IssuedCertificate } from '../types';
import CertificatePreview from '../components/CertificatePreview';
import { downloadCertificatePdf } from '../lib/certificatePdf';
import { getVerificationUrl } from '../lib/certificateTemplates';

export default function Certificates() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [certs, setCerts] = useState<IssuedCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'certificates'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IssuedCertificate, 'id'>),
        }));
        list.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
        setCerts(list);
        setLoading(false);
      },
      (err) => {
        console.error('Load certificates error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const filtered = certs.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.eventTitle.toLowerCase().includes(q) ||
      c.templateCategory.toLowerCase().includes(q) ||
      c.certificateId.toLowerCase().includes(q)
    );
  });

  const handleShare = async (cert: IssuedCertificate) => {
    const url = getVerificationUrl(cert.certificateId);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${cert.title} — ${cert.eventTitle}`,
          text: `Verify my Campus Connect certificate (${cert.certificateId})`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Verification link copied to clipboard.', 'success');
      }
    } catch {
      showToast(`Verification ID: ${cert.certificateId}`, 'info');
    }
  };

  const handleDownload = async (cert: IssuedCertificate) => {
    try {
      const canvas = document.getElementById(`cert-qr-${cert.certificateId}`) as HTMLCanvasElement | null;
      await downloadCertificatePdf(cert, canvas);
      showToast('Certificate PDF downloaded.', 'success');
    } catch {
      showToast('Unable to download PDF right now.', 'error');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-full glass border border-border-subtle flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Student Credentials</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Certificates</h1>
          </div>
        </div>

        <Link
          to="/verify-certificate"
          className="px-4 py-2 rounded-xl border border-border-subtle text-xs sm:text-sm font-semibold hover:bg-secondary/10 transition-colors self-start sm:self-auto"
        >
          Public Verification Lookup
        </Link>
      </div>

      <div className="glass rounded-xl px-3.5 flex items-center gap-2.5 max-w-md">
        <Search size={16} className="text-secondary shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search certificates by event, category, or ID..."
          className="w-full h-11 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="glass h-72 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((cert) => (
            <article key={cert.id} className="glass rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <CertificatePreview certificate={cert} />
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold truncate">{cert.eventTitle}</h2>
                    <p className="text-xs text-secondary truncate">
                      {cert.templateCategory} · Issued {cert.issueDate}
                    </p>
                    <p className="text-[11px] font-mono text-primary mt-0.5">{cert.certificateId}</p>
                  </div>
                  {cert.status === 'revoked' ? (
                    <span className="text-xs font-semibold text-red-500 flex items-center gap-1 shrink-0">
                      <ShieldAlert size={14} /> Revoked
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-500 shrink-0">Verified</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  disabled={cert.status === 'revoked'}
                  onClick={() => handleDownload(cert)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleShare(cert)}
                  className="py-2.5 px-3 rounded-xl border border-border-subtle text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-secondary/10"
                >
                  <Share2 size={14} /> Share
                </button>
                <Link
                  to={`/verify-certificate/${cert.certificateId}`}
                  className="py-2.5 px-3 rounded-xl border border-border-subtle text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-secondary/10"
                >
                  <ExternalLink size={14} /> Verify
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass rounded-3xl p-12 text-center border-dashed space-y-3">
          <Award size={32} className="text-primary mx-auto" />
          <h2 className="text-lg font-bold">No certificates earned yet</h2>
          <p className="text-sm text-secondary max-w-md mx-auto">
            Register for campus events and complete QR attendance check-in at the venue. Once published by organisers, your verified certificates appear here automatically.
          </p>
          <Link
            to="/explore"
            className="inline-flex px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90"
          >
            Explore Upcoming Events
          </Link>
        </div>
      )}
    </div>
  );
}
