import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  Search,
  CheckCircle2,
  ShieldAlert,
  FileWarning,
  ArrowLeft,
  Download,
  Award,
  Calendar,
  Building2,
  User as UserIcon,
} from 'lucide-react';
import { db } from '../firebase';
import { IssuedCertificate } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PublicNavbar from '../components/PublicNavbar';
import CertificatePreview from '../components/CertificatePreview';
import { downloadCertificatePdf } from '../lib/certificatePdf';
import { useDocumentSeo } from '../lib/seo';

export default function VerifyCertificate() {
  const { certificateId: routeCertId } = useParams<{ certificateId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lookupInput, setLookupInput] = useState(routeCertId || '');
  const [loading, setLoading] = useState(Boolean(routeCertId));
  const [cert, setCert] = useState<IssuedCertificate | null>(null);
  const [notFound, setNotFound] = useState(false);

  useDocumentSeo({
    title: routeCertId
      ? `Verify Credential ${routeCertId} | Campus Connect`
      : 'Verify Digital Certificate | Campus Connect',
    description:
      'Instantly verify official university event certificates issued through Campus Connect using a unique Certificate ID or verification QR code.',
    canonicalPath: routeCertId ? `verify-certificate/${routeCertId}` : 'verify-certificate',
  });

  useEffect(() => {
    const id = (routeCertId || '').trim().toUpperCase();
    setLookupInput(id);
    if (!id) {
      setCert(null);
      setNotFound(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'certificates', id));
        if (cancelled) return;
        if (snap.exists()) {
          setCert({ id: snap.id, ...(snap.data() as Omit<IssuedCertificate, 'id'>) });
          setNotFound(false);
        } else {
          setCert(null);
          setNotFound(true);
        }
      } catch (err) {
        console.error('Certificate verification lookup error:', err);
        if (!cancelled) {
          setCert(null);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeCertId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = lookupInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!clean) {
      showToast('Enter a valid Certificate ID (e.g. CC-XXXX-XXXX).', 'info');
      return;
    }
    navigate(`/verify-certificate/${clean}`);
  };

  const handleDownloadPdf = async () => {
    if (!cert) return;
    try {
      const canvas = document.getElementById(`cert-qr-${cert.certificateId}`) as HTMLCanvasElement | null;
      await downloadCertificatePdf(cert, canvas);
      showToast('Certificate PDF downloaded.', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to export certificate PDF.', 'error');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <PublicNavbar />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {user && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="w-10 h-10 rounded-full glass border border-border-subtle flex items-center justify-center shrink-0"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary tracking-wide uppercase">
                Public Credential Registry
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Verify Digital Certificate
              </h1>
            </div>
          </div>

          <Link
            to="/explore"
            className="px-4 py-2 rounded-xl border border-border-subtle text-xs sm:text-sm font-semibold hover:bg-secondary/10 transition-colors self-start sm:self-auto"
          >
            Browse Campus Events
          </Link>
        </div>

        {/* Lookup Bar */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-4 sm:p-5 space-y-3">
          <label htmlFor="cert-lookup-input" className="block text-xs font-semibold text-secondary">
            Certificate ID
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 rounded-xl bg-background border border-border-subtle">
              <Search size={16} className="text-secondary shrink-0" />
              <input
                id="cert-lookup-input"
                type="text"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Enter Certificate ID (e.g. CC-8F4A21B9-31D9E2C4)"
                className="w-full h-11 bg-transparent text-sm font-mono focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
            >
              Verify Credential
            </button>
          </div>
          <p className="text-xs text-secondary">
            Each certificate issued on Campus Connect contains a unique alphanumeric identifier and verification QR code linked directly to Firestore.
          </p>
        </form>

        {/* Results */}
        {loading ? (
          <div className="glass rounded-3xl p-12 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-secondary font-medium">Checking institutional ledger...</p>
          </div>
        ) : cert ? (
          <div className="space-y-6">
            {/* Status Banner */}
            <div
              className={`rounded-2xl p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                cert.status === 'revoked'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    cert.status === 'revoked'
                      ? 'bg-red-500/20 text-red-500'
                      : 'bg-emerald-500/20 text-emerald-500'
                  }`}
                >
                  {cert.status === 'revoked' ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
                </div>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-extrabold">
                    {cert.status === 'revoked'
                      ? 'Certificate Revoked'
                      : 'Verified Authentic Credential'}
                  </p>
                  <p className="text-xs sm:text-sm text-secondary mt-0.5">
                    {cert.status === 'revoked'
                      ? cert.revokedReason || 'This credential has been invalidated by the Super Admin.'
                      : `Confirmed in Campus Connect registry under ID ${cert.certificateId}.`}
                  </p>
                </div>
              </div>

              {cert.status === 'valid' && (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shrink-0"
                >
                  <Download size={16} />
                  Download Official PDF
                </button>
              )}
            </div>

            {/* Metadata Summary Grid (Public-safe fields only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-secondary mb-1">
                  <UserIcon size={14} className="text-primary" />
                  Recipient
                </div>
                <p className="text-sm font-bold truncate">{cert.holderName}</p>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-secondary mb-1">
                  <Award size={14} className="text-primary" />
                  Event & Category
                </div>
                <p className="text-sm font-bold truncate">{cert.eventTitle}</p>
                <p className="text-xs text-secondary truncate">{cert.templateCategory}</p>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-secondary mb-1">
                  <Building2 size={14} className="text-primary" />
                  Issuing Authority
                </div>
                <p className="text-sm font-bold truncate">{cert.issuingAuthority}</p>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-secondary mb-1">
                  <Calendar size={14} className="text-primary" />
                  Issue Date
                </div>
                <p className="text-sm font-bold tabular-nums">{cert.issueDate}</p>
              </div>
            </div>

            {/* Live Rendered Preview */}
            <div className="glass rounded-3xl p-4 sm:p-6">
              <CertificatePreview certificate={cert} />
            </div>
          </div>
        ) : notFound ? (
          <div className="glass rounded-3xl p-10 sm:p-12 text-center space-y-3 border-dashed">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <FileWarning size={24} />
            </div>
            <h2 className="text-lg font-bold">No matching certificate found</h2>
            <p className="text-sm text-secondary max-w-md mx-auto">
              We could not find an issued credential matching <span className="font-mono font-semibold text-foreground">{routeCertId}</span>. Check the ID spelling or scan the QR code directly from the PDF certificate.
            </p>
          </div>
        ) : (
          <div className="glass rounded-3xl p-10 text-center space-y-2 border-dashed">
            <Award size={28} className="text-primary mx-auto mb-2" />
            <h2 className="text-lg font-bold">Enter a Certificate ID to verify</h2>
            <p className="text-sm text-secondary max-w-md mx-auto">
              Employers, faculty coordinators, and campus organisers can confirm participant eligibility and authenticity in seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
