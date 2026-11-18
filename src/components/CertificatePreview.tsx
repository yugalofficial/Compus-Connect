import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ShieldAlert, Award } from 'lucide-react';
import {
  CertificateElementKey,
  CertificateElementPosition,
  IssuedCertificate,
} from '../types';
import { getVerificationUrl, interpolateCertificateText } from '../lib/certificateTemplates';

interface CertificatePreviewProps {
  certificate: IssuedCertificate;
  editable?: boolean;
  selectedElement?: CertificateElementKey | null;
  onSelectElement?: (key: CertificateElementKey) => void;
  onUpdateElement?: (key: CertificateElementKey, pos: CertificateElementPosition) => void;
  className?: string;
}

export default function CertificatePreview({
  certificate,
  editable = false,
  selectedElement = null,
  onSelectElement,
  onUpdateElement,
  className = '',
}: CertificatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPortrait = certificate.orientation === 'portrait';
  const verifyUrl = getVerificationUrl(certificate.certificateId);

  const bodyCopy = interpolateCertificateText(certificate.description, {
    participantName: certificate.holderName,
    eventTitle: certificate.eventTitle,
    issueDate: certificate.issueDate,
    certificateId: certificate.certificateId,
  });

  const handlePointerDrag = (key: CertificateElementKey) => (e: React.PointerEvent) => {
    if (!editable || !containerRef.current || !onUpdateElement) return;
    e.stopPropagation();
    onSelectElement?.(key);

    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const current = certificate.elements[key] || { x: 50, y: 50, align: 'center' };

    const onMove = (moveEvent: PointerEvent) => {
      const dxPct = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dyPct = ((moveEvent.clientY - startY) / rect.height) * 100;
      const nextX = Math.max(12, Math.min(88, Math.round(current.x + dxPct)));
      const nextY = Math.max(10, Math.min(90, Math.round(current.y + dyPct)));
      onUpdateElement(key, { ...current, x: nextX, y: nextY });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const getPositionStyle = (key: CertificateElementKey): React.CSSProperties => {
    const pos = certificate.elements?.[key] || { x: 50, y: 50, align: 'center' };
    return {
      left: `${pos.x}%`,
      top: `${pos.y}%`,
      transform: 'translate(-50%, -50%)',
      textAlign: pos.align || 'center',
    };
  };

  const selectableClass = (key: CertificateElementKey) =>
    editable
      ? `cursor-grab active:cursor-grabbing rounded-lg px-2 py-1 transition-shadow ${
          selectedElement === key
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-transparent bg-primary/5'
            : 'hover:ring-1 hover:ring-primary/50'
        }`
      : '';

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: certificate.backgroundColor || '#ffffff',
        color: certificate.textColor || '#0f172a',
        fontFamily: certificate.fontFamily || 'Plus Jakarta Sans',
        aspectRatio: isPortrait ? '210 / 297' : '297 / 210',
      }}
      className={`relative w-full overflow-hidden rounded-2xl shadow-lg border border-border-subtle select-none ${className}`}
    >
      {/* Optional custom background image */}
      {certificate.backgroundImageUrl && (
        <img
          src={certificate.backgroundImageUrl}
          alt="Certificate background"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Architectural double guilloche border */}
      <div
        className="absolute inset-[2.6%] border-2 pointer-events-none"
        style={{ borderColor: certificate.accentColor || '#1e3a8a' }}
      />
      <div
        className="absolute inset-[3.8%] border pointer-events-none opacity-75"
        style={{ borderColor: certificate.accentColor || '#1e3a8a' }}
      />

      {/* Top University & Society logos */}
      {certificate.universityLogoUrl && (
        <img
          src={certificate.universityLogoUrl}
          alt="University crest"
          className="absolute left-[6%] top-[6.5%] w-[9%] aspect-square object-contain pointer-events-none rounded"
          referrerPolicy="no-referrer"
        />
      )}
      {certificate.societyLogoUrl ? (
        <img
          src={certificate.societyLogoUrl}
          alt="Society emblem"
          className="absolute right-[6%] top-[6.5%] w-[9%] aspect-square object-contain pointer-events-none rounded"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="absolute right-[6%] top-[6.5%] w-[8.5%] aspect-square rounded-full border-2 flex items-center justify-center pointer-events-none opacity-85"
          style={{ borderColor: certificate.accentColor, color: certificate.accentColor }}
        >
          <Award className="w-1/2 h-1/2" />
        </div>
      )}

      {/* Authority Header */}
      <div
        onPointerDown={handlePointerDrag('authority')}
        style={getPositionStyle('authority')}
        className={`absolute w-[74%] ${selectableClass('authority')}`}
      >
        <p
          className="text-[clamp(7px,1.25vw,13px)] font-extrabold tracking-[0.18em] uppercase"
          style={{ color: certificate.accentColor }}
        >
          {certificate.issuingAuthority || 'Campus Connect University Portal'}
        </p>
        <p className="text-[clamp(6px,0.95vw,10px)] font-semibold tracking-[0.14em] uppercase opacity-75 mt-0.5">
          {certificate.subtitle || certificate.templateCategory}
        </p>
      </div>

      {/* Main Title */}
      <div
        onPointerDown={handlePointerDrag('title')}
        style={getPositionStyle('title')}
        className={`absolute w-[82%] ${selectableClass('title')}`}
      >
        <h3 className="text-[clamp(14px,3.1vw,34px)] font-extrabold tracking-tight leading-tight">
          {certificate.title}
        </h3>
        <p
          className="text-[clamp(6px,1vw,11px)] font-bold tracking-[0.16em] uppercase mt-1.5"
          style={{ color: certificate.accentColor }}
        >
          This is proudly presented to
        </p>
      </div>

      {/* Recipient Name */}
      <div
        onPointerDown={handlePointerDrag('recipient')}
        style={getPositionStyle('recipient')}
        className={`absolute w-[80%] ${selectableClass('recipient')}`}
      >
        <p
          className="text-[clamp(16px,3.4vw,38px)] font-extrabold tracking-tight leading-tight truncate"
          style={{ color: certificate.accentColor }}
        >
          {certificate.holderName}
        </p>
        <div
          className="mx-auto mt-1.5 h-[2px] w-2/5 opacity-70"
          style={{ backgroundColor: certificate.accentColor }}
        />
      </div>

      {/* Citation Body */}
      <div
        onPointerDown={handlePointerDrag('body')}
        style={getPositionStyle('body')}
        className={`absolute w-[78%] ${selectableClass('body')}`}
      >
        <p className="text-[clamp(8px,1.35vw,14px)] leading-relaxed opacity-90">{bodyCopy}</p>
        <p className="text-[clamp(7px,1vw,11px)] opacity-70 mt-1.5 font-medium">
          Issued on {certificate.issueDate}
        </p>
      </div>

      {/* Signatory Block */}
      <div
        onPointerDown={handlePointerDrag('signatures')}
        style={getPositionStyle('signatures')}
        className={`absolute ${isPortrait ? 'w-[76%]' : 'w-[46%]'} flex items-end justify-center gap-6 ${selectableClass('signatures')}`}
      >
        <div className="flex flex-col items-center min-w-0">
          {certificate.signatureImageUrl && (
            <img
              src={certificate.signatureImageUrl}
              alt="Organiser signature"
              className="h-[clamp(16px,3vw,32px)] object-contain mb-0.5 pointer-events-none"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="w-24 sm:w-28 border-t border-current opacity-50 mb-1" />
          <p className="text-[clamp(7px,1.1vw,11px)] font-bold truncate max-w-full">
            {certificate.organiserName || 'Event Organiser'}
          </p>
          <p className="text-[clamp(6px,0.9vw,9.5px)] opacity-70 truncate max-w-full">
            {certificate.signatoryDesignation || 'Organising Lead'}
          </p>
        </div>

        {certificate.facultyCoordinator && (
          <div className="flex flex-col items-center min-w-0">
            <div className="w-24 sm:w-28 border-t border-current opacity-50 mb-1" />
            <p className="text-[clamp(7px,1.1vw,11px)] font-bold truncate max-w-full">
              {certificate.facultyCoordinator}
            </p>
            <p className="text-[clamp(6px,0.9vw,9.5px)] opacity-70 truncate max-w-full">
              Faculty Coordinator
            </p>
          </div>
        )}
      </div>

      {/* Verification QR & ID */}
      {certificate.includeQr !== false && (
        <div
          onPointerDown={handlePointerDrag('qr')}
          style={getPositionStyle('qr')}
          className={`absolute flex flex-col items-center ${selectableClass('qr')}`}
        >
          <div className="p-1 bg-white rounded-md shadow-sm border border-slate-200">
            <QRCodeCanvas
              id={`cert-qr-${certificate.certificateId}`}
              value={verifyUrl}
              size={68}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-[clamp(6px,0.85vw,9px)] font-mono font-bold mt-1 tracking-tight">
            {certificate.certificateId}
          </p>
        </div>
      )}

      {/* Revoked Overlay */}
      {certificate.status === 'revoked' && (
        <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="border-2 border-red-400 bg-red-950/90 text-white px-5 py-3 rounded-2xl text-center max-w-sm shadow-2xl">
            <ShieldAlert size={24} className="text-red-400 mx-auto mb-1" />
            <p className="text-sm font-extrabold tracking-widest uppercase text-red-300">
              Certificate Revoked
            </p>
            {certificate.revokedReason && (
              <p className="text-xs text-red-100 mt-1">{certificate.revokedReason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
