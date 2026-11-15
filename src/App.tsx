import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
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

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router basename={import.meta.env.BASE_URL}>
            <div className="min-h-dvh flex flex-col bg-background text-foreground transition-colors duration-200">
              <RoleHeader />

              <main className="flex-1 w-full pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-8">
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

                  {/* Approved Authenticated Routes */}
                  <Route
                    path="/event/:id"
                    element={
                      <ProtectedRoute>
                        <EventDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/events/:slug"
                    element={
                      <ProtectedRoute>
                        <EventDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/explore"
                    element={
                      <ProtectedRoute>
                        <Explore />
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
                  <Route
                    path="/society/:id"
                    element={
                      <ProtectedRoute>
                        <SocietyProfile />
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
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
