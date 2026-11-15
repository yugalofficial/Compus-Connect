import React, { useState, useEffect } from 'react';
import {
  signInWithGoogle,
  auth,
  db,
  resetUserPassword,
  SUPER_ADMIN_EMAIL,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  Building2,
  GraduationCap,
  Utensils,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRoleHomePath } from '../components/ProtectedRoute';
import ThemeToggle from '../components/ThemeToggle';
import { sendTransactionalEmail } from '../lib/api';

export default function Login() {
  const { user, firebaseUser, loading: authLoading, platformSettings } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'google-onboarding'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'student' | 'organizer' | 'canteen'>('student');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect authenticated user with completed profile directly to their role dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getRoleHomePath(user.role), { replace: true });
    } else if (!authLoading && firebaseUser && !user) {
      // Signed in via Google without a Firestore profile yet
      setName(firebaseUser.displayName || '');
      setEmail(firebaseUser.email || '');
      setMode('google-onboarding');
    }
  }, [user, firebaseUser, authLoading, navigate]);

  const getInitialApprovalStatus = (selectedRole: UserRole, userEmail: string): 'approved' | 'pending' => {
    if (userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return 'approved';
    if (selectedRole === 'student') {
      return platformSettings.requireStudentApproval ? 'pending' : 'approved';
    }
    if (selectedRole === 'organizer') {
      return platformSettings.requireOrganizerApproval ? 'pending' : 'approved';
    }
    if (selectedRole === 'canteen') {
      return platformSettings.requireCanteenApproval ? 'pending' : 'approved';
    }
    return 'pending';
  };

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is disabled in Firebase Console. Please enable Email/Password under Authentication -> Sign-in method, or use Continue with Google.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Please verify your credentials or register a new account.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters long.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in popup was closed before completing.';
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Domain "${host}" is not authorized for Google Sign-In yet. Add "${host}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    }
    return err?.message || 'Authentication failed. Please try again.';
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      const fbUser = result.user;
      const isSuperAdmin = fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const userSnap = await getDoc(doc(db, 'users', fbUser.uid));

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        showToast(`Welcome back, ${userData.name}`, 'success');
        navigate(getRoleHomePath(userData.role), { replace: true });
      } else if (isSuperAdmin) {
        const superAdmin: User = {
          uid: fbUser.uid,
          name: fbUser.displayName || 'Super Admin',
          email: fbUser.email || SUPER_ADMIN_EMAIL,
          role: 'admin',
          status: 'approved',
          interests: [],
          points: 0,
          badges: ['Super Admin'],
          followedSocieties: [],
          photoURL: fbUser.photoURL || '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', fbUser.uid), superAdmin);
        showToast('Signed in as Super Admin', 'success');
        navigate('/admin', { replace: true });
      } else {
        setName(fbUser.displayName || '');
        setEmail(fbUser.email || '');
        setMode('google-onboarding');
      }
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSubmitting(true);
    setError('');

    try {
      const status = getInitialApprovalStatus(role, firebaseUser.email || email);
      const profile: User = {
        uid: firebaseUser.uid,
        name: name.trim() || firebaseUser.displayName || 'Campus User',
        email: firebaseUser.email || email,
        role,
        status,
        phone: phone.trim(),
        college: role === 'student' ? college.trim() : '',
        course: role === 'student' ? course.trim() : '',
        organisation: role === 'organizer' ? organisation.trim() : '',
        vendorName: role === 'canteen' ? vendorName.trim() : '',
        upiId: role === 'canteen' ? upiId.trim() : '',
        interests: [],
        points: 0,
        badges: [],
        followedSocieties: [],
        photoURL: firebaseUser.photoURL || '',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), profile);

      // Welcome notification
      await addDoc(collection(db, 'notifications'), {
        userId: firebaseUser.uid,
        title: status === 'approved' ? 'Account Activated' : 'Profile Submitted for Approval',
        message:
          status === 'approved'
            ? 'Welcome to Campus Connect! Your portal is active.'
            : 'Your registration has been submitted to the Super Admin for verification.',
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
      });

      showToast(
        status === 'approved' ? 'Profile created!' : 'Profile submitted for Super Admin approval.',
        'success'
      );
      navigate(getRoleHomePath(role), { replace: true });
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'forgot') {
        await resetUserPassword(email.trim());
        showToast('Password reset link sent to your email address.', 'success');
        setMode('login');
        return;
      }

      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          showToast(`Signed in as ${userData.name}`, 'success');
          navigate(getRoleHomePath(userData.role), { replace: true });
        } else {
          setName(userCredential.user.displayName || '');
          setMode('google-onboarding');
        }
        return;
      }

      // Register
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setSubmitting(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;
      await updateProfile(fbUser, { displayName: name.trim() });

      const status = getInitialApprovalStatus(role, email.trim());
      const newUser: User = {
        uid: fbUser.uid,
        name: name.trim(),
        email: email.trim(),
        role,
        status,
        phone: phone.trim(),
        college: role === 'student' ? college.trim() : '',
        course: role === 'student' ? course.trim() : '',
        organisation: role === 'organizer' ? organisation.trim() : '',
        vendorName: role === 'canteen' ? vendorName.trim() : '',
        upiId: role === 'canteen' ? upiId.trim() : '',
        interests: [],
        points: 0,
        badges: [],
        followedSocieties: [],
        photoURL: '',
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', fbUser.uid), newUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
      }

      await addDoc(collection(db, 'notifications'), {
        userId: fbUser.uid,
        title: status === 'approved' ? 'Welcome to Campus Connect' : 'Pending Super Admin Approval',
        message:
          status === 'approved'
            ? 'Your account is active and ready to use.'
            : 'Your profile has been sent to the Super Admin for verification.',
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Trigger welcome email in background (uses backend or Apps Script on GitHub Pages)
      sendTransactionalEmail(
        {
          to: email.trim(),
          subject: 'Welcome to Campus Connect!',
          templateName: 'welcome',
          params: {
            name: name.trim(),
            appUrl: `${window.location.origin}${import.meta.env.BASE_URL}`,
          },
        },
        platformSettings.appsScriptUrl
      ).catch(() => {});

      showToast(
        status === 'approved'
          ? 'Account created! Redirecting to your portal.'
          : 'Account created! Awaiting Super Admin approval.',
        'success'
      );
      navigate(getRoleHomePath(role), { replace: true });
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="p-4 sm:px-6 flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 pb-12">
        <div className="w-full max-w-lg glass rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              {mode === 'login' && 'Sign in to Campus Connect'}
              {mode === 'register' && 'Create your campus account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'google-onboarding' && 'Complete your profile'}
            </h1>
            <p className="text-sm text-secondary">
              {mode === 'login' && 'Enter your credentials or sign in with Google to access your role dashboard.'}
              {mode === 'register' && 'Select your campus role. Accounts are verified by the Super Admin.'}
              {mode === 'forgot' && 'Enter your registered email to receive a password reset link.'}
              {mode === 'google-onboarding' && 'Choose your campus role and details to submit for Super Admin approval.'}
            </p>
          </div>

          {mode !== 'forgot' && mode !== 'google-onboarding' && (
            <div className="flex p-1 rounded-xl bg-background border border-border-subtle mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'login' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'register' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                Register Account
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={mode === 'google-onboarding' ? handleCompleteGoogleOnboarding : handleSubmit} className="space-y-4">
            {(mode === 'register' || mode === 'google-onboarding') && (
              <>
                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">Account Role</label>
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-background border border-border-subtle">
                    {(
                      [
                        { id: 'student', label: 'Student' },
                        { id: 'organizer', label: 'Organiser' },
                        { id: 'canteen', label: 'Canteen' },
                      ] as const
                    ).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                          role === r.id ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                    <input
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {role === 'student' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-secondary block mb-1.5">College / Dept</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                        <input
                          type="text"
                          placeholder="e.g. CSE Dept"
                          className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={college}
                          onChange={(e) => setCollege(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondary block mb-1.5">Course & Year</label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                        <input
                          type="text"
                          placeholder="e.g. B.Tech 3rd Year"
                          className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {role === 'organizer' && (
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1.5">Society / Club Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                      <input
                        type="text"
                        placeholder="e.g. Techvora Society"
                        className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={organisation}
                        onChange={(e) => setOrganisation(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {role === 'canteen' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-secondary block mb-1.5">Canteen / Vendor Name</label>
                      <div className="relative">
                        <Utensils className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                        <input
                          type="text"
                          placeholder="e.g. Main Cafeteria"
                          className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={vendorName}
                          onChange={(e) => setVendorName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-secondary block mb-1.5">Payout UPI ID</label>
                      <input
                        type="text"
                        placeholder="e.g. canteen@upi"
                        className="w-full bg-background border border-border-subtle rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {mode !== 'google-onboarding' && (
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                  <input
                    type="email"
                    placeholder="name@campus.edu"
                    className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-secondary">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    className="w-full bg-background border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <><LogIn size={16} /> Sign In</>
              ) : mode === 'register' ? (
                <><UserPlus size={16} /> Create Account</>
              ) : mode === 'forgot' ? (
                <><KeyRound size={16} /> Send Reset Email</>
              ) : (
                <><ShieldCheck size={16} /> Submit Profile</>
              )}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2.5 text-xs font-semibold text-secondary hover:text-foreground"
              >
                Back to Sign In
              </button>
            )}
          </form>

          {(mode === 'login' || mode === 'register') && (
            <>
              <div className="my-6 flex items-center gap-3 text-secondary">
                <div className="h-px flex-1 bg-border-subtle" />
                <span className="text-xs font-medium">or</span>
                <div className="h-px flex-1 bg-border-subtle" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full py-3.5 rounded-xl border border-border-subtle font-semibold text-sm hover:bg-secondary/10 transition-colors flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
                </svg>
                Continue with Google
              </button>

              <p className="mt-5 text-xs text-secondary text-center leading-relaxed">
                Super Admin ({SUPER_ADMIN_EMAIL}) signs in directly via Google to approve accounts, provision credentials, and manage all campus portals.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
