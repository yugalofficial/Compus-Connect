import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import {
  ProtectedRoute,
  StudentRoute,
  AdminRoute,
  OrganiserRoute,
  CanteenRoute,
} from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';
import RoleHeader from './components/RoleHeader';
import ErrorBoundary from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BeforeInstallPromptBanner } from './components/BeforeInstallPromptBanner';
import Landing from './pages/Landing';
import HowToUse from './pages/HowToUse';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';
import Profile from './pages/Profile';
import Calendar from './pages/Calendar';
import CreateEvent from './pages/CreateEvent';
import SocietyProfile from './pages/SocietyProfile';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ManageEvent from './pages/ManageEvent';
import CreateSociety from './pages/CreateSociety';
import CanteenPortal from './pages/CanteenPortal';
import AdminDashboard from './pages/AdminDashboard';
import Societies from './pages/Societies';
import VerifyCertificate from './pages/VerifyCertificate';
import CertificateStudio from './pages/CertificateStudio';
import Certificates from './pages/Certificates';
import Analytics from './pages/Analytics';

function AppLayout() {
  const { user, isApproved } = useAuth();
  const hasBottomNav = Boolean(user && isApproved);

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip flex flex-col bg-background text-foreground transition-colors duration-200">
      <RoleHeader />

      <main
        className={`flex-1 w-full min-w-0 ${
          hasBottomNav ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-8' : ''
        }`}
      >
        <ErrorBoundary>
          <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/how-to-use" element={<HowToUse />} />
                  <Route path="/login" element={<Login />} />

                  {/* Student Primary Feed */}
                  <Route
                    path="/home"
                    element={
                      <StudentRoute>
                        <Home />
                      </StudentRoute>
                    }
                  />

                  {/* Public & Cross-Role Discovery Routes */}
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/societies" element={<Societies />} />
                  <Route path="/society/:id" element={<SocietyProfile />} />
                  <Route path="/event/:id" element={<EventDetails />} />
                  <Route path="/events/:slug" element={<EventDetails />} />
                  <Route path="/verify-certificate" element={<VerifyCertificate />} />
                  <Route path="/verify-certificate/:certificateId" element={<VerifyCertificate />} />

                  {/* Approved Authenticated Routes */}
                  <Route
                    path="/certificates"
                    element={
                      <ProtectedRoute>
                        <Certificates />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <ProtectedRoute>
                        <Calendar />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />

                  {/* Organiser & Admin Routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <OrganiserRoute>
                        <Dashboard />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/create-society"
                    element={
                      <OrganiserRoute>
                        <CreateSociety />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/edit-society/:id"
                    element={
                      <OrganiserRoute>
                        <CreateSociety />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/create"
                    element={
                      <OrganiserRoute>
                        <CreateEvent />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/edit/:id"
                    element={
                      <OrganiserRoute>
                        <CreateEvent />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/manage/:id"
                    element={
                      <OrganiserRoute>
                        <ManageEvent />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/manage/:id/certificates"
                    element={
                      <OrganiserRoute>
                        <CertificateStudio />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/certificates/studio"
                    element={
                      <OrganiserRoute>
                        <CertificateStudio />
                      </OrganiserRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <OrganiserRoute>
                        <Analytics />
                      </OrganiserRoute>
                    }
                  />

                  {/* Canteen Routes */}
                  <Route
                    path="/canteen"
                    element={
                      <CanteenRoute>
                        <CanteenPortal />
                      </CanteenRoute>
                    }
                  />

                  {/* Super Admin Only */}
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <OfflineIndicator />
      <BeforeInstallPromptBanner />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router basename={import.meta.env.BASE_URL}>
            <AppLayout />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
