export type UserRole = 'student' | 'organizer' | 'admin' | 'canteen';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface NotificationPreferences {
  eventReminders: boolean;
  paymentUpdates: boolean;
  certificates: boolean;
  societyAnnouncements: boolean;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  college?: string;
  course?: string;
  interests: string[];
  points: number;
  badges: string[];
  societyId?: string;
  followedSocieties: string[];
  photoURL?: string;
  vendorName?: string;
  organisation?: string;
  upiId?: string;
  razorpayId?: string;
  notificationPreferences?: NotificationPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformSettings {
  requireStudentApproval: boolean;
  requireOrganizerApproval: boolean;
  requireCanteenApproval: boolean;
  platformUpiId: string;
  supportEmail: string;
  appsScriptUrl?: string;
  lastSheetsSyncAt?: string;
  lastSheetsSyncStatus?: 'success' | 'skipped' | 'error';
  lastDriveSyncAt?: string;
}

export interface EventScheduleItem {
  time: string;
  title: string;
  speaker?: string;
}

export interface EventSpeaker {
  name: string;
  role: string;
  bio?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  registrationDeadline?: string;
  venue: string;
  mapUrl?: string;
  organizerId: string;
  organizerName?: string;
  societyId?: string;
  category: string;
  type: 'free' | 'paid';
  fee?: number;
  couponCost?: number;
  maxCoupons?: number;
  registrationLimit: number;
  registeredCount: number;
  allowWaitlist?: boolean;
  waitlistCount?: number;
  posterUrl?: string;
  galleryUrls?: string[];
  schedule?: EventScheduleItem[];
  speakers?: EventSpeaker[];
  requirements?: string;
  slug: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  isCancelled?: boolean;
  cancellationReason?: string;
  hasFoodCoupon: boolean;
  isCanteenPaymentDone?: boolean;
  upiId?: string;
  createdAt?: any;
  updatedAt?: any;
  // QR Control
  qrVisible: boolean;
  qrExpiry?: string;
  qrScanLimit?: number;
  qrScanStart?: string;
  qrScanEnd?: string;
  couponsDistributed?: boolean;
}

export interface Registration {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  eventId: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'waitlisted';
  paymentId?: string;
  transactionId?: string;
  paymentScreenshot?: string;
  ticketId?: string;
  attended: boolean;
  couponRedeemed: boolean;
  couponRedeemedAt?: string;
  couponActive?: boolean;
  qrCode?: string;
  scannedAt?: string;
  validationToken?: string;
  createdAt?: string;
}

export interface Attendance {
  id: string;
  userId: string;
  eventId: string;
  scanTime: string;
  verifiedBy: string;
}

export interface CouponRedemption {
  id: string;
  userId: string;
  eventId: string;
  redeemedAt: string;
  vendorId: string;
}

export interface CanteenPayment {
  id: string;
  eventId: string;
  eventTitle: string;
  organizerId: string;
  vendorId: string;
  vendorUpiId?: string;
  amount: number;
  studentCount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  timestamp: string;
  razorpayPaymentId?: string;
  upiTransactionId?: string;
  requestedAt: string;
  paidAt?: string;
  paymentScreenshot?: string;
}

export interface SocietyCoreMember {
  name: string;
  role: string;
}

export interface SocietyAnnouncement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface Society {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  bannerUrl?: string;
  followerCount: number;
  organizerId: string;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  facultyCoordinator?: {
    name: string;
    department?: string;
    email?: string;
  };
  coreTeam?: SocietyCoreMember[];
  announcements?: SocietyAnnouncement[];
  galleryUrls?: string[];
  socials?: {
    website?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface SocietyApplication {
  id: string;
  societyId: string;
  societyName: string;
  organizerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleInterest: string;
  statement: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: any;
}

export type CertificateTemplateCategory =
  | 'Event Participation Certificate'
  | 'Workshop Completion Certificate'
  | 'Hackathon Participation Certificate'
  | 'Competition Winner Certificate'
  | 'First Position Certificate'
  | 'Second Position Certificate'
  | 'Third Position Certificate'
  | 'Volunteer Appreciation Certificate'
  | 'Internship Completion Certificate'
  | 'Society Membership Certificate'
  | 'Speaker Appreciation Certificate'
  | 'Leadership and Organising Committee Certificate';

export type CertificateElementKey =
  | 'authority'
  | 'title'
  | 'recipient'
  | 'body'
  | 'signatures'
  | 'qr';

export interface CertificateElementPosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
}

export interface CertificateCampaign {
  id: string;
  eventId: string;
  eventTitle: string;
  organizerId: string;
  societyId?: string;
  templateCategory: CertificateTemplateCategory;
  orientation: 'landscape' | 'portrait';
  title: string;
  subtitle: string;
  description: string;
  issuingAuthority: string;
  facultyCoordinator: string;
  organiserName: string;
  signatoryDesignation: string;
  issueDate: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  fontFamily: 'Plus Jakarta Sans' | 'DM Sans' | 'Georgia' | 'JetBrains Mono';
  backgroundImageUrl?: string;
  universityLogoUrl?: string;
  societyLogoUrl?: string;
  signatureImageUrl?: string;
  includeQr: boolean;
  elements: Record<CertificateElementKey, CertificateElementPosition>;
  publishedCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface IssuedCertificate {
  id: string;
  certificateId: string;
  campaignId: string;
  eventId: string;
  eventTitle: string;
  registrationId: string;
  userId: string;
  holderName: string;
  organizerId: string;
  issuingAuthority: string;
  templateCategory: CertificateTemplateCategory;
  orientation: 'landscape' | 'portrait';
  title: string;
  subtitle: string;
  description: string;
  facultyCoordinator: string;
  organiserName: string;
  signatoryDesignation: string;
  issueDate: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  fontFamily: 'Plus Jakarta Sans' | 'DM Sans' | 'Georgia' | 'JetBrains Mono';
  backgroundImageUrl?: string;
  universityLogoUrl?: string;
  societyLogoUrl?: string;
  signatureImageUrl?: string;
  includeQr: boolean;
  elements: Record<CertificateElementKey, CertificateElementPosition>;
  status: 'valid' | 'revoked';
  revokedReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  issuedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'user' | 'event' | 'society' | 'certificate' | 'payment' | 'system';
  targetId: string;
  details: string;
  createdAt: string;
}
