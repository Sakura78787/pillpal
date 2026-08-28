import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { AuthStatus } from '@/types/auth';
import MainLayout from '@/components/layout/MainLayout';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import Medications from '@/pages/Medications';
import AddMedication from '@/pages/AddMedication';
import EditMedication from '@/pages/EditMedication';
import Logs from '@/pages/Logs';
import Appointments from '@/pages/Appointments';
import Inventory from '@/pages/Inventory';
import Health from '@/pages/Health';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import About from '@/pages/About';
import ReminderSettings from '@/pages/ReminderSettings';
import WeeklyReport from '@/pages/WeeklyReport';
import CareOverview from '@/pages/CareOverview';
import EvalLab from '@/pages/EvalLab';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      <p className="mt-3 text-gray-500 text-sm">加载中...</p>
    </div>
  </div>
);

export const isRouteAccessAllowed = (authStatus, allowGuest = false) => (
  authStatus === AuthStatus.AUTHENTICATED || (allowGuest && authStatus === AuthStatus.GUEST)
);

const ProtectedRoute = ({ children, showNav = true, allowGuest = false }) => {
  const location = useLocation();
  const { authStatus } = useAuthStore();

  if (authStatus === 'authenticating') {
    return <LoadingScreen />;
  }

  if (!isRouteAccessAllowed(authStatus, allowGuest)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <MainLayout showNav={showNav}>{children}</MainLayout>;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/dashboard" element={<ProtectedRoute allowGuest><Dashboard /></ProtectedRoute>} />
    <Route path="/medications" element={<ProtectedRoute allowGuest><Medications /></ProtectedRoute>} />
    <Route path="/medications/add" element={<ProtectedRoute showNav={false} allowGuest><AddMedication /></ProtectedRoute>} />
    <Route path="/medications/edit/:id" element={<ProtectedRoute showNav={false} allowGuest><EditMedication /></ProtectedRoute>} />
    <Route path="/logs" element={<ProtectedRoute allowGuest><Logs /></ProtectedRoute>} />
    <Route path="/appointments" element={<ProtectedRoute allowGuest><Appointments /></ProtectedRoute>} />
    <Route path="/inventory" element={<ProtectedRoute allowGuest><Inventory /></ProtectedRoute>} />
    <Route path="/health" element={<ProtectedRoute allowGuest><Health /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute allowGuest><Profile /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/about" element={<ProtectedRoute allowGuest><About /></ProtectedRoute>} />
    <Route path="/profile/reminders" element={<ProtectedRoute><ReminderSettings /></ProtectedRoute>} />
    <Route path="/weekly-report" element={<ProtectedRoute allowGuest><WeeklyReport /></ProtectedRoute>} />
    <Route path="/care" element={<ProtectedRoute allowGuest><CareOverview /></ProtectedRoute>} />
    <Route path="/eval-lab" element={<ProtectedRoute><EvalLab /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  const { initializeAuth, subscribeToAuthChanges, authStatus, error } = useAuthStore();
  const { initializeUI } = useUIStore();

  useEffect(() => {
    initializeAuth();
    initializeUI();
    const unsubscribe = subscribeToAuthChanges();
    return unsubscribe;
  }, [initializeAuth, initializeUI, subscribeToAuthChanges]);

  if (authStatus === 'authenticating') {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontSize: '14px',
          },
        }}
      />
      {authStatus === 'error' && error && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 px-4 py-2 text-center text-sm text-white">
          {error}
        </div>
      )}
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
