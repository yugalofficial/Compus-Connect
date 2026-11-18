import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Download,
  Palette,
  Send,
  Upload,
  Users,
  XCircle,
  Move,
  Sparkles,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CertificateCampaign,
  CertificateElementKey,
  CertificateElementPosition,
  CertificateTemplateCategory,
  Event,
  IssuedCertificate,
  Registration,
  User,
} from '../types';
import {
  CERTIFICATE_TEMPLATE_PRESETS,
  buildCertificateId,
  getDefaultElements,
} from '../lib/certificateTemplates';
import { compressImageToDataUrl } from '../lib/media';
import { downloadCertificatePdf } from '../lib/certificatePdf';
import CertificatePreview from '../components/CertificatePreview';

export default function CertificateStudio() {
  const { id: routeEventId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { showToast, confirm } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(routeEventId || '');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [existingCerts, setExistingCerts] = useState<Record<string, IssuedCertificate>>({});
  const [campaigns, setCampaigns] = useState<CertificateCampaign[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'design' | 'eligible' | 'ineligible' | 'issued'>('design');
  const [selectedElement, setSelectedElement] = useState<CertificateElementKey | null>('title');
  const [issuing, setIssuing] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Design form state
  const defaultPreset = CERTIFICATE_TEMPLATE_PRESETS[0];
  const [templateCategory, setTemplateCategory] = useState<CertificateTemplateCategory>(defaultPreset.category);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [title, setTitle] = useState(defaultPreset.defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultPreset.defaultSubtitle);
  const [description, setDescription] = useState(defaultPreset.defaultDescription);
  const [issuingAuthority, setIssuingAuthority] = useState('Campus Connect University Portal');
  const [facultyCoordinator, setFacultyCoordinator] = useState('');
  const [organiserName, setOrganiserName] = useState(user?.name || 'Event Organiser');
  const [signatoryDesignation, setSignatoryDesignation] = useState('Event Lead');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [backgroundColor, setBackgroundColor] = useState(defaultPreset.backgroundColor);
  const [accentColor, setAccentColor] = useState(defaultPreset.accentColor);
  const [textColor, setTextColor] = useState(defaultPreset.textColor);
  const [fontFamily, setFontFamily] = useState<CertificateCampaign['fontFamily']>(defaultPreset.fontFamily);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [universityLogoUrl, setUniversityLogoUrl] = useState('');
  const [societyLogoUrl, setSocietyLogoUrl] = useState('');
  const [signatureImageUrl, setSignatureImageUrl] = useState('');
  const [includeQr, setIncludeQr] = useState(true);
  const [elements, setElements] = useState<Record<CertificateElementKey, CertificateElementPosition>>(
    getDefaultElements('landscape')
  );
  const [activeCampaignId, setActiveCampaignId] = useState<string>('');

  // Load organiser's (or admin's all) events
  useEffect(() => {
    if (!user) return;
    const eventsQ = isAdmin
      ? collection(db, 'events')
      : query(collection(db, 'events'), where('organizerId', '==', user.uid));

    const unsub = onSnapshot(eventsQ, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Event, 'id'>) }));
      list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setEvents(list);
      if (!selectedEventId && list.length > 0) {
        setSelectedEventId(routeEventId || list[0].id);
      }
    });
    return () => unsub();
  }, [user, isAdmin, routeEventId]);

  useEffect(() => {
    if (routeEventId) setSelectedEventId(routeEventId);
  }, [routeEventId]);

  // Load users lookup + campaigns
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const map: Record<string, User> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { uid: d.id, ...(d.data() as Omit<User, 'uid'>) };
        });
        setUsersMap(map);
      })
      .catch((err) => console.error('Load users error:', err));

    const campQ = isAdmin
      ? collection(db, 'certificate_campaigns')
      : query(collection(db, 'certificate_campaigns'), where('organizerId', '==', user.uid));
    const unsubCamp = onSnapshot(campQ, (snap) => {
      setCampaigns(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CertificateCampaign, 'id'>) }))
      );
    });
    return () => unsubCamp();
  }, [user, isAdmin]);

  // Load registrations and existing issued certificates for selected event
  useEffect(() => {
    if (!selectedEventId) {
      setRegistrations([]);
      setExistingCerts({});
      return;
    }

    const unsubReg = onSnapshot(
      query(collection(db, 'registrations'), where('eventId', '==', selectedEventId)),
      (snap) => {
        setRegistrations(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Registration, 'id'>) }))
        );
      }
    );

    const certQ = isAdmin
      ? query(collection(db, 'certificates'), where('eventId', '==', selectedEventId))
      : query(
          collection(db, 'certificates'),
          where('eventId', '==', selectedEventId),
          where('organizerId', '==', user?.uid || '')
        );
    const unsubCert = onSnapshot(certQ, (snap) => {
      const map: Record<string, IssuedCertificate> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as IssuedCertificate;
        map[data.certificateId] = { ...data, id: d.id };
      });
      setExistingCerts(map);
    });

    return () => {
      unsubReg();
      unsubCert();
    };
  }, [selectedEventId, isAdmin, user?.uid]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  // Sync saved campaign if found for selected event
  useEffect(() => {
    if (!selectedEvent) return;
    const match = campaigns.find((c) => c.eventId === selectedEvent.id);
    if (match) {
      setActiveCampaignId(match.id);
      setTemplateCategory(match.templateCategory);
      setOrientation(match.orientation);
      setTitle(match.title);
      setSubtitle(match.subtitle || '');
      setDescription(match.description);
      setIssuingAuthority(match.issuingAuthority);
      setFacultyCoordinator(match.facultyCoordinator || '');
      setOrganiserName(match.organiserName || selectedEvent.organizerName || user?.name || 'Organiser');
      setSignatoryDesignation(match.signatoryDesignation || 'Event Lead');
      setIssueDate(match.issueDate || new Date().toISOString().slice(0, 10));
      setBackgroundColor(match.backgroundColor);
      setAccentColor(match.accentColor);
      setTextColor(match.textColor);
      setFontFamily(match.fontFamily);
      setBackgroundImageUrl(match.backgroundImageUrl || '');
      setUniversityLogoUrl(match.universityLogoUrl || '');
      setSocietyLogoUrl(match.societyLogoUrl || '');
      setSignatureImageUrl(match.signatureImageUrl || '');
      setIncludeQr(match.includeQr !== false);
      setElements(match.elements || getDefaultElements(match.orientation));
    } else {
      setActiveCampaignId('');
      setOrganiserName(selectedEvent.organizerName || user?.name || 'Event Organiser');
    }
  }, [selectedEvent?.id, campaigns.length]);

  const eligibleParticipants = useMemo(
    () => registrations.filter((r) => r.status === 'confirmed' && r.attended === true),
    [registrations]
  );

  const ineligibleParticipants = useMemo(
    () => registrations.filter((r) => !(r.status === 'confirmed' && r.attended === true)),
    [registrations]
  );

  const pendingEligibilityToIssue = useMemo(
    () =>
      eligibleParticipants.filter((reg) => {
        const certId = buildCertificateId(reg.eventId, reg.userId);
        return !existingCerts[certId];
      }),
    [eligibleParticipants, existingCerts]
  );

  const applyPreset = (cat: CertificateTemplateCategory) => {
    const preset = CERTIFICATE_TEMPLATE_PRESETS.find((p) => p.category === cat);
    if (!preset) return;
    setTemplateCategory(cat);
    setTitle(preset.defaultTitle);
    setSubtitle(preset.defaultSubtitle);
    setDescription(preset.defaultDescription);
    setBackgroundColor(preset.backgroundColor);
    setAccentColor(preset.accentColor);
    setTextColor(preset.textColor);
    setFontFamily(preset.fontFamily);
  };

  const toggleOrientation = (next: 'landscape' | 'portrait') => {
    setOrientation(next);
    setElements(getDefaultElements(next));
  };

  const handleImageUpload = async (
    file: File | undefined,
    setter: (val: string) => void,
    maxWidth: number
  ) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, maxWidth, 0.78);
      setter(dataUrl);
      showToast('Asset uploaded and compressed cleanly.', 'success');
    } catch {
      showToast('Could not read image asset.', 'error');
    }
  };

  const sampleReg =
    eligibleParticipants.find((r) => r.userId === selectedParticipantId) ||
    eligibleParticipants[0] ||
    null;

  const sampleHolderName = sampleReg
    ? usersMap[sampleReg.userId]?.name || sampleReg.userName || 'Verified Student'
    : 'Aarav Sharma';

  const previewCert: IssuedCertificate = {
    id: 'preview',
    certificateId: sampleReg
      ? buildCertificateId(sampleReg.eventId, sampleReg.userId)
      : 'CC-SAMPLE01-USER0001',
    campaignId: activeCampaignId || 'draft',
    eventId: selectedEvent?.id || 'sample-event',
    eventTitle: selectedEvent?.title || 'Annual Campus Innovation Summit',
    registrationId: sampleReg?.id || 'sample-reg',
    userId: sampleReg?.userId || 'sample-user',
    holderName: sampleHolderName,
    organizerId: selectedEvent?.organizerId || user?.uid || 'organiser',
    issuingAuthority,
    templateCategory,
    orientation,
    title,
    subtitle,
    description,
    facultyCoordinator,
    organiserName,
    signatoryDesignation,
    issueDate,
    backgroundColor,
    accentColor,
    textColor,
    fontFamily,
    backgroundImageUrl,
    universityLogoUrl,
    societyLogoUrl,
    signatureImageUrl,
    includeQr,
    elements,
    status: 'valid',
    issuedAt: new Date().toISOString(),
  };

  const saveCampaignDoc = async (): Promise<string> => {
    if (!selectedEvent || !user) throw new Error('Select an event first');
    const campaignId = activeCampaignId || `camp_${selectedEvent.id}`;
    const payload: Omit<CertificateCampaign, 'id'> = {
      eventId: selectedEvent.id,
      eventTitle: selectedEvent.title,
      organizerId: selectedEvent.organizerId || user.uid,
      societyId: selectedEvent.societyId || '',
      templateCategory,
      orientation,
      title,
      subtitle,
      description,
      issuingAuthority,
      facultyCoordinator,
      organiserName,
      signatoryDesignation,
      issueDate,
      backgroundColor,
      accentColor,
      textColor,
      fontFamily,
      backgroundImageUrl,
      universityLogoUrl,
      societyLogoUrl,
      signatureImageUrl,
      includeQr,
      elements,
      publishedCount: Object.keys(existingCerts).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'certificate_campaigns', campaignId), payload, { merge: true });
    setActiveCampaignId(campaignId);
    return campaignId;
  };

  const handleSaveCampaign = async () => {
    if (!selectedEvent) {
      showToast('Select an event to save its certificate template.', 'info');
      return;
    }
    setSavingCampaign(true);
    try {
      await saveCampaignDoc();
      showToast('Certificate template saved to Firestore.', 'success');
    } catch (err) {
      console.error('Save campaign error:', err);
      showToast('Failed to save template. Check your permissions.', 'error');
    } finally {
      setSavingCampaign(false);
    }
  };

  const issueForList = async (targets: Registration[]) => {
    if (!selectedEvent || !user) return;
    if (targets.length === 0) {
      showToast('No new eligible participants (confirmed + attended) waiting for certificates.', 'info');
      return;
    }

    const ok = await confirm({
      title: 'Publish Digital Certificates',
      message: `Issue ${targets.length} verified certificate(s) for "${selectedEvent.title}"? Already issued IDs are automatically skipped.`,
      confirmText: `Issue ${targets.length} Certificate(s)`,
    });
    if (!ok) return;

    setIssuing(true);
    try {
      const campaignId = await saveCampaignDoc();
      let issuedNow = 0;

      for (const reg of targets) {
        if (reg.status !== 'confirmed' || reg.attended !== true) continue;
        const certId = buildCertificateId(selectedEvent.id, reg.userId);
        if (existingCerts[certId]) continue;

        const studentProfile = usersMap[reg.userId];
        const holderName = studentProfile?.name || reg.userName || 'Verified Participant';

        const certPayload: Omit<IssuedCertificate, 'id'> = {
          certificateId: certId,
          campaignId,
          eventId: selectedEvent.id,
          eventTitle: selectedEvent.title,
          registrationId: reg.id,
          userId: reg.userId,
          holderName,
          organizerId: selectedEvent.organizerId || user.uid,
          issuingAuthority,
          templateCategory,
          orientation,
          title,
          subtitle,
          description,
          facultyCoordinator,
          organiserName,
          signatoryDesignation,
          issueDate,
          backgroundColor,
          accentColor,
          textColor,
          fontFamily,
          backgroundImageUrl,
          universityLogoUrl,
          societyLogoUrl,
          signatureImageUrl,
          includeQr,
          elements,
          status: 'valid',
          issuedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'certificates', certId), certPayload);
        await addDoc(collection(db, 'notifications'), {
          userId: reg.userId,
          title: 'Certificate Issued',
          message: `Your ${templateCategory} for "${selectedEvent.title}" is now ready to download and verify (${certId}).`,
          type: 'certificate',
          read: false,
          createdAt: new Date().toISOString(),
        });
        issuedNow++;
      }

      await updateDoc(doc(db, 'certificate_campaigns', campaignId), {
        publishedCount: Object.keys(existingCerts).length + issuedNow,
        updatedAt: new Date().toISOString(),
      });

      showToast(
        issuedNow > 0
          ? `Issued ${issuedNow} digital certificate(s) with QR verification.`
          : 'All eligible participants already received their certificates.',
        issuedNow > 0 ? 'success' : 'info'
      );
    } catch (err) {
      console.error('Issue certificates error:', err);
      showToast('Failed while issuing certificates. Confirm participants are checked in.', 'error');
    } finally {
      setIssuing(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const canvas = document.getElementById(`cert-qr-${previewCert.certificateId}`) as HTMLCanvasElement | null;
      await downloadCertificatePdf(previewCert, canvas);
      showToast('Sample certificate PDF downloaded.', 'success');
    } catch {
      showToast('Failed to export sample PDF.', 'error');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-10 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-10 h-10 rounded-full glass border border-border-subtle flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              Digital Credential Studio
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
              Certificate Designer & Issuance
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            aria-label="Select event"
            className="h-10 px-3.5 rounded-xl glass border border-border-subtle text-sm font-semibold max-w-xs"
          >
            {events.length === 0 ? (
              <option value="">No hosted events available</option>
            ) : (
              events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            onClick={handleSaveCampaign}
            disabled={savingCampaign || !selectedEvent}
            className="h-10 px-4 rounded-xl border border-border-subtle text-sm font-semibold hover:bg-secondary/10 disabled:opacity-50"
          >
            {savingCampaign ? 'Saving...' : 'Save Template'}
          </button>

          <button
            type="button"
            onClick={() => issueForList(pendingEligibilityToIssue)}
            disabled={issuing || pendingEligibilityToIssue.length === 0}
            className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            <Send size={15} />
            {issuing ? 'Publishing...' : `Publish Pending (${pendingEligibilityToIssue.length})`}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-secondary">Total Registrations</p>
          <p className="text-2xl font-extrabold tabular-nums mt-1">{registrations.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-secondary">Eligible (Attended)</p>
          <p className="text-2xl font-extrabold text-emerald-500 tabular-nums mt-1">
            {eligibleParticipants.length}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-secondary">Ineligible / Absent</p>
          <p className="text-2xl font-extrabold text-amber-500 tabular-nums mt-1">
            {ineligibleParticipants.length}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-secondary">Certificates Issued</p>
          <p className="text-2xl font-extrabold text-primary tabular-nums mt-1">
            {Object.keys(existingCerts).length}
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1.5 p-1 glass rounded-xl w-fit overflow-x-auto max-w-full">
        {(
          [
            { id: 'design', label: 'Visual Designer' },
            { id: 'eligible', label: `Eligible (${eligibleParticipants.length})` },
            { id: 'ineligible', label: `Ineligible (${ineligibleParticipants.length})` },
            { id: 'issued', label: `Issued Ledger (${Object.keys(existingCerts).length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'design' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls */}
          <div className="lg:col-span-5 glass rounded-3xl p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Palette size={17} className="text-primary" />
                Template & Typography
              </h2>
              <div className="flex p-0.5 rounded-lg border border-border-subtle text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => toggleOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-md ${orientation === 'landscape' ? 'bg-primary text-white' : 'text-secondary'}`}
                >
                  Landscape
                </button>
                <button
                  type="button"
                  onClick={() => toggleOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-md ${orientation === 'portrait' ? 'bg-primary text-white' : 'text-secondary'}`}
                >
                  Portrait
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  Certificate Category Preset (12 Institutional Templates)
                </label>
                <select
                  value={templateCategory}
                  onChange={(e) => applyPreset(e.target.value as CertificateTemplateCategory)}
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                >
                  {CERTIFICATE_TEMPLATE_PRESETS.map((p) => (
                    <option key={p.category} value={p.category}>
                      {p.category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  Citation Body (supports {'{{eventTitle}}'}, {'{{participantName}}'})
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-xl bg-background border border-border-subtle text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Issuing Authority</label>
                  <input
                    type="text"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Organiser Name</label>
                  <input
                    type="text"
                    value={organiserName}
                    onChange={(e) => setOrganiserName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Designation</label>
                  <input
                    type="text"
                    value={signatoryDesignation}
                    onChange={(e) => setSignatoryDesignation(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Faculty Coordinator</label>
                  <input
                    type="text"
                    value={facultyCoordinator}
                    placeholder="Optional"
                    onChange={(e) => setFacultyCoordinator(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border-subtle text-sm"
                  />
                </div>
              </div>

              {/* Colors & Font */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Background</label>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-full h-9 rounded-lg cursor-pointer bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Accent</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full h-9 rounded-lg cursor-pointer bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Text</label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full h-9 rounded-lg cursor-pointer bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Font</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as CertificateCampaign['fontFamily'])}
                    className="w-full h-9 px-2 rounded-lg bg-background border border-border-subtle text-xs"
                  >
                    <option value="Plus Jakarta Sans">Jakarta Sans</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Georgia">Classic Serif</option>
                    <option value="JetBrains Mono">Monospace</option>
                  </select>
                </div>
              </div>

              {/* Image Uploads */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <label className="cursor-pointer px-3 py-2 rounded-xl border border-border-subtle hover:bg-secondary/10 text-xs font-semibold flex items-center gap-2">
                  <Upload size={14} className="text-primary shrink-0" />
                  <span className="truncate">{universityLogoUrl ? 'University Logo ✓' : 'University Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0], setUniversityLogoUrl, 360)}
                  />
                </label>
                <label className="cursor-pointer px-3 py-2 rounded-xl border border-border-subtle hover:bg-secondary/10 text-xs font-semibold flex items-center gap-2">
                  <Upload size={14} className="text-primary shrink-0" />
                  <span className="truncate">{societyLogoUrl ? 'Society Logo ✓' : 'Society Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0], setSocietyLogoUrl, 360)}
                  />
                </label>
                <label className="cursor-pointer px-3 py-2 rounded-xl border border-border-subtle hover:bg-secondary/10 text-xs font-semibold flex items-center gap-2">
                  <Upload size={14} className="text-primary shrink-0" />
                  <span className="truncate">{signatureImageUrl ? 'Signature ✓' : 'Upload Signature'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0], setSignatureImageUrl, 360)}
                  />
                </label>
                <label className="cursor-pointer px-3 py-2 rounded-xl border border-border-subtle hover:bg-secondary/10 text-xs font-semibold flex items-center gap-2">
                  <Upload size={14} className="text-primary shrink-0" />
                  <span className="truncate">{backgroundImageUrl ? 'Backdrop ✓' : 'Custom Backdrop'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0], setBackgroundImageUrl, 1280)}
                  />
                </label>
              </div>

              <label className="flex items-center justify-between pt-2 text-xs font-semibold">
                <span>Embed QR Verification & Unique Certificate ID</span>
                <input
                  type="checkbox"
                  checked={includeQr}
                  onChange={(e) => setIncludeQr(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
              </label>

              {/* Selected Element Coordinates Fine Tuning */}
              {selectedElement && elements[selectedElement] && (
                <div className="p-3 rounded-xl bg-background/60 border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5 capitalize">
                      <Move size={13} className="text-primary" />
                      Selected Block: {selectedElement}
                    </span>
                    <button
                      type="button"
                      onClick={() => setElements(getDefaultElements(orientation))}
                      className="text-primary font-semibold hover:underline"
                    >
                      Reset Layout
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="space-y-1">
                      <span className="text-secondary">Horizontal X ({elements[selectedElement].x}%)</span>
                      <input
                        type="range"
                        min={15}
                        max={85}
                        value={elements[selectedElement].x}
                        onChange={(e) =>
                          setElements((prev) => ({
                            ...prev,
                            [selectedElement]: { ...prev[selectedElement], x: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-secondary">Vertical Y ({elements[selectedElement].y}%)</span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={elements[selectedElement].y}
                        onChange={(e) =>
                          setElements((prev) => ({
                            ...prev,
                            [selectedElement]: { ...prev[selectedElement], y: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Live Preview */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass rounded-3xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-1.5">
                    <Sparkles size={15} className="text-primary" />
                    Interactive Certificate Canvas
                  </h2>
                  <p className="text-xs text-secondary">
                    Drag any text block or QR stamp to adjust layout placement live.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {eligibleParticipants.length > 0 && (
                    <select
                      value={sampleReg?.userId || ''}
                      onChange={(e) => setSelectedParticipantId(e.target.value)}
                      className="h-9 px-2.5 rounded-xl bg-background border border-border-subtle text-xs font-medium"
                    >
                      {eligibleParticipants.map((r) => (
                        <option key={r.id} value={r.userId}>
                          Preview: {usersMap[r.userId]?.name || r.userName || r.userId}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="h-9 px-3 rounded-xl border border-border-subtle text-xs font-semibold flex items-center gap-1.5 hover:bg-secondary/10"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                </div>
              </div>

              <CertificatePreview
                certificate={previewCert}
                editable
                selectedElement={selectedElement}
                onSelectElement={setSelectedElement}
                onUpdateElement={(key, pos) =>
                  setElements((prev) => ({
                    ...prev,
                    [key]: pos,
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'eligible' && (
        <div className="glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                Eligible Participants (Payment Verified & Attendance Marked)
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Firestore rules enforce both confirmed registration and QR check-in attendance before issuing.
              </p>
            </div>
            <button
              type="button"
              disabled={issuing || pendingEligibilityToIssue.length === 0}
              onClick={() => issueForList(pendingEligibilityToIssue)}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-50"
            >
              Issue All Pending ({pendingEligibilityToIssue.length})
            </button>
          </div>

          {eligibleParticipants.length === 0 ? (
            <div className="py-12 text-center text-sm text-secondary">
              No confirmed participants have completed QR attendance check-in for this event yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-border-subtle text-xs text-secondary">
                  <tr>
                    <th className="py-2.5 pr-4">Participant</th>
                    <th className="py-2.5 pr-4">Certificate ID</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {eligibleParticipants.map((reg) => {
                    const certId = buildCertificateId(reg.eventId, reg.userId);
                    const issued = existingCerts[certId];
                    const profile = usersMap[reg.userId];
                    return (
                      <tr key={reg.id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold">{profile?.name || reg.userName || 'Student'}</p>
                          <p className="text-xs text-secondary">{profile?.email || reg.userEmail || reg.userId}</p>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">{certId}</td>
                        <td className="py-3 pr-4">
                          {issued ? (
                            <span className="text-xs font-semibold text-emerald-500">
                              Issued ({issued.status})
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-500">Ready to Issue</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {issued ? (
                            <button
                              type="button"
                              onClick={() => downloadCertificatePdf(issued)}
                              className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-semibold hover:bg-secondary/10"
                            >
                              PDF
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={issuing}
                              onClick={() => issueForList([reg])}
                              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90"
                            >
                              Issue Single
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ineligible' && (
        <div className="glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <XCircle size={18} className="text-amber-500" />
              Ineligible Registrations (Blocked by Attendance Policy)
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Students who did not check in via QR attendance or whose payment is still pending/rejected cannot receive certificates.
            </p>
          </div>
          {ineligibleParticipants.length === 0 ? (
            <div className="py-12 text-center text-sm text-secondary">
              Every registrant for this event has met eligibility requirements.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-border-subtle text-xs text-secondary">
                  <tr>
                    <th className="py-2.5 pr-4">Student</th>
                    <th className="py-2.5 pr-4">Registration Status</th>
                    <th className="py-2.5">Attendance Check-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {ineligibleParticipants.map((reg) => {
                    const profile = usersMap[reg.userId];
                    return (
                      <tr key={reg.id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold">{profile?.name || reg.userName || reg.userId}</p>
                          <p className="text-xs text-secondary">{profile?.email || reg.userEmail || ''}</p>
                        </td>
                        <td className="py-3 pr-4 capitalize text-xs font-semibold">{reg.status}</td>
                        <td className="py-3 text-xs text-amber-500 font-semibold">
                          {reg.attended ? 'Checked In' : 'Not Checked In'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'issued' && (
        <div className="glass rounded-3xl p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award size={18} className="text-primary" />
            Issued Credential Ledger
          </h2>
          {Object.keys(existingCerts).length === 0 ? (
            <div className="py-12 text-center text-sm text-secondary">
              No certificates issued for this event yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(existingCerts).map((c) => (
                <div key={c.certificateId} className="rounded-2xl border border-border-subtle p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{c.holderName}</p>
                      <p className="text-xs font-mono text-secondary truncate">{c.certificateId}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold capitalize ${
                        c.status === 'revoked' ? 'text-red-500' : 'text-emerald-500'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadCertificatePdf(c)}
                      className="flex-1 py-2 rounded-xl border border-border-subtle text-xs font-semibold hover:bg-secondary/10"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/verify-certificate/${c.certificateId}`)}
                      className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90"
                    >
                      Verify Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
