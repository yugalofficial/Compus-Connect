export type UserRole = 'student' | 'organizer' | 'admin' | 'canteen';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

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
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformSettings {
  requireStudentApproval: boolean;
  requireOrganizerApproval: boolean;
  requireCanteenApproval: boolean;
  platformUpiId: string;
  supportEmail: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  organizerId: string;
  societyId?: string;
  category: string;
  type: 'free' | 'paid';
  fee?: number;
  couponCost?: number;
  maxCoupons?: number;
  registrationLimit: number;
  registeredCount: number;
  posterUrl?: string;
  slug: string;
  status: 'upcoming' | 'ongoing' | 'completed';
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
  status: 'pending' | 'confirmed' | 'rejected';
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

export interface Society {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  bannerUrl?: string;
  followerCount: number;
  organizerId: string;
  socials?: {
    website?: string;
    instagram?: string;
    twitter?: string;
  };
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
