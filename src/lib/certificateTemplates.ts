import {
  CertificateElementKey,
  CertificateElementPosition,
  CertificateTemplateCategory,
} from '../types';

export interface CertificateTemplatePreset {
  category: CertificateTemplateCategory;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultDescription: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  fontFamily: 'Plus Jakarta Sans' | 'DM Sans' | 'Georgia' | 'JetBrains Mono';
}

export const CERTIFICATE_TEMPLATE_PRESETS: CertificateTemplatePreset[] = [
  {
    category: 'Event Participation Certificate',
    defaultTitle: 'Certificate of Participation',
    defaultSubtitle: 'OFFICIAL CAMPUS CREDENTIAL',
    defaultDescription:
      'is awarded this certificate in recognition of active participation in {{eventTitle}} organised under Campus Connect.',
    backgroundColor: '#ffffff',
    accentColor: '#1e3a8a',
    textColor: '#0f172a',
    fontFamily: 'Plus Jakarta Sans',
  },
  {
    category: 'Workshop Completion Certificate',
    defaultTitle: 'Certificate of Completion',
    defaultSubtitle: 'HANDS-ON TECHNICAL WORKSHOP',
    defaultDescription:
      'has successfully completed all sessions and practical modules of {{eventTitle}} held on campus.',
    backgroundColor: '#f8fafc',
    accentColor: '#2563eb',
    textColor: '#0f172a',
    fontFamily: 'DM Sans',
  },
  {
    category: 'Hackathon Participation Certificate',
    defaultTitle: 'Hackathon Builder Credential',
    defaultSubtitle: 'INNOVATION & PROTOTYPING',
    defaultDescription:
      'contributed code, product architecture, and live sprint demonstrations during {{eventTitle}}.',
    backgroundColor: '#0f172a',
    accentColor: '#38bdf8',
    textColor: '#f8fafc',
    fontFamily: 'Plus Jakarta Sans',
  },
  {
    category: 'Competition Winner Certificate',
    defaultTitle: 'Certificate of Excellence',
    defaultSubtitle: 'COMPETITION WINNER',
    defaultDescription:
      'achieved winning distinction in {{eventTitle}}, demonstrating outstanding performance and merit.',
    backgroundColor: '#fffdf7',
    accentColor: '#b45309',
    textColor: '#1e293b',
    fontFamily: 'Georgia',
  },
  {
    category: 'First Position Certificate',
    defaultTitle: 'First Position Honour',
    defaultSubtitle: 'RANK 1 · GOLD DISTINCTION',
    defaultDescription:
      'secured First Position in {{eventTitle}} among competing university teams and participants.',
    backgroundColor: '#fffdf7',
    accentColor: '#ca8a04',
    textColor: '#0f172a',
    fontFamily: 'Georgia',
  },
  {
    category: 'Second Position Certificate',
    defaultTitle: 'Second Position Honour',
    defaultSubtitle: 'RANK 2 · SILVER DISTINCTION',
    defaultDescription:
      'secured Second Position in {{eventTitle}} for commendable execution and competitive merit.',
    backgroundColor: '#f8fafc',
    accentColor: '#475569',
    textColor: '#0f172a',
    fontFamily: 'Georgia',
  },
  {
    category: 'Third Position Certificate',
    defaultTitle: 'Third Position Honour',
    defaultSubtitle: 'RANK 3 · BRONZE DISTINCTION',
    defaultDescription:
      'secured Third Position in {{eventTitle}} in recognition of skilled performance and dedication.',
    backgroundColor: '#fffaf5',
    accentColor: '#9a3412',
    textColor: '#1e293b',
    fontFamily: 'Georgia',
  },
  {
    category: 'Volunteer Appreciation Certificate',
    defaultTitle: 'Certificate of Appreciation',
    defaultSubtitle: 'STUDENT VOLUNTEER CORPS',
    defaultDescription:
      'is appreciated for dedicated volunteer coordination and operational support throughout {{eventTitle}}.',
    backgroundColor: '#ffffff',
    accentColor: '#0f766e',
    textColor: '#0f172a',
    fontFamily: 'DM Sans',
  },
  {
    category: 'Internship Completion Certificate',
    defaultTitle: 'Internship Completion Certificate',
    defaultSubtitle: 'VERIFIED ACADEMIC EXPERIENCE',
    defaultDescription:
      'has successfully fulfilled all deliverables and evaluation milestones during {{eventTitle}}.',
    backgroundColor: '#ffffff',
    accentColor: '#1e40af',
    textColor: '#0f172a',
    fontFamily: 'Plus Jakarta Sans',
  },
  {
    category: 'Society Membership Certificate',
    defaultTitle: 'Certificate of Membership',
    defaultSubtitle: 'RECOGNISED CAMPUS SOCIETY',
    defaultDescription:
      'is an officially inducted active member contributing to initiatives led during {{eventTitle}}.',
    backgroundColor: '#f8fafc',
    accentColor: '#3730a3',
    textColor: '#0f172a',
    fontFamily: 'Plus Jakarta Sans',
  },
  {
    category: 'Speaker Appreciation Certificate',
    defaultTitle: 'Speaker Appreciation',
    defaultSubtitle: 'DISTINGUISHED GUEST SESSION',
    defaultDescription:
      'is gratefully recognised for sharing domain insights and mentoring students at {{eventTitle}}.',
    backgroundColor: '#fffdf7',
    accentColor: '#1e3a8a',
    textColor: '#0f172a',
    fontFamily: 'Georgia',
  },
  {
    category: 'Leadership and Organising Committee Certificate',
    defaultTitle: 'Organising Committee Honour',
    defaultSubtitle: 'CAMPUS LEADERSHIP CREDENTIAL',
    defaultDescription:
      'served with distinction on the Organising Committee, successfully delivering {{eventTitle}}.',
    backgroundColor: '#0b132b',
    accentColor: '#f59e0b',
    textColor: '#f8fafc',
    fontFamily: 'Plus Jakarta Sans',
  },
];

export function getDefaultElements(
  orientation: 'landscape' | 'portrait'
): Record<CertificateElementKey, CertificateElementPosition> {
  if (orientation === 'portrait') {
    return {
      authority: { x: 50, y: 14, fontSize: 13, align: 'center' },
      title: { x: 50, y: 27, fontSize: 30, align: 'center' },
      recipient: { x: 50, y: 44, fontSize: 32, align: 'center' },
      body: { x: 50, y: 58, fontSize: 14, align: 'center' },
      signatures: { x: 50, y: 78, fontSize: 12, align: 'center' },
      qr: { x: 50, y: 90, fontSize: 11, align: 'center' },
    };
  }
  return {
    authority: { x: 50, y: 14, fontSize: 13, align: 'center' },
    title: { x: 50, y: 27, fontSize: 32, align: 'center' },
    recipient: { x: 50, y: 46, fontSize: 34, align: 'center' },
    body: { x: 50, y: 60, fontSize: 14, align: 'center' },
    signatures: { x: 36, y: 81, fontSize: 12, align: 'center' },
    qr: { x: 85, y: 81, fontSize: 11, align: 'center' },
  };
}

export function buildCertificateId(eventId: string, userId: string): string {
  const cleanEvent = eventId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const cleanUser = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `CC-${cleanEvent}-${cleanUser}`;
}

export function getVerificationUrl(certificateId: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${base}/verify-certificate/${certificateId}`;
  }
  return `https://yugalofficial.github.io/Compus-Connect/verify-certificate/${certificateId}`;
}

export function interpolateCertificateText(
  template: string,
  vars: {
    participantName: string;
    eventTitle: string;
    issueDate: string;
    certificateId: string;
  }
): string {
  return (template || '')
    .replace(/\{\{\s*participantName\s*\}\}/gi, vars.participantName)
    .replace(/\{\{\s*eventTitle\s*\}\}/gi, vars.eventTitle)
    .replace(/\{\{\s*issueDate\s*\}\}/gi, vars.issueDate)
    .replace(/\{\{\s*certificateId\s*\}\}/gi, vars.certificateId);
}
