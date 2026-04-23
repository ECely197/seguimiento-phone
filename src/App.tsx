import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProcessPage from './pages/ProcessPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import AcwPractice from './pages/AcwPractice';
import ExecutiveReportPage from './pages/ExecutiveReportPage';
import HourlyTrendsPage from './pages/HourlyTrendsPage';
import PdaManualPage from './pages/PdaManualPage';
import ExecutivePlanPage from './pages/ExecutivePlanPage';
import IdleTrackerRecord from './pages/IdleTrackerRecord';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import AgentChats from './pages/AgentChats';
import FloatingNav from './components/FloatingNav';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import './App.css';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, db } from './firebaseConfig';
import { getUserDoc } from './firebasePaths';
import { ADMIN_UID } from './constants';

const PermissionGuard = ({ section, children }: { section: 'canViewTraining' | 'canViewQuizzes' | 'canViewACW' | 'canViewIdle' | 'canViewMetrics' | 'canViewChats', children: React.ReactElement }) => {
  const { permissions, loading } = usePermissions();
  if (loading) return <div className="flex h-screen items-center justify-center bg-white dark:bg-[#121212]"><div className="animate-spin rounded-full h-12 w-12 border-4 border-m3-primary border-t-transparent"></div></div>;
  if (!permissions[section]) return <Navigate to="/home" replace />;
  return children;
};

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Hide navbar on login page AND admin dashboard
  const PUBLIC_NO_NAV = ['/login', '/admin', '/', '/executive-report/team-vitals', '/executive-report/hourly-trends', '/pda-manual', '/executive-plan'];
  const showNavbar = !PUBLIC_NO_NAV.includes(location.pathname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      let currentRole = null;

      if (user) {
        try {
          const userRef = getUserDoc(user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            currentRole = 'user';
            if (user.uid === ADMIN_UID) currentRole = 'admin';

            await setDoc(userRef, {
              email: user.email,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              role: currentRole,
              lob: 'phone'
            });
          } else {
            const data = userSnap.data();
            currentRole = data.role || (data.isAdmin ? 'admin' : 'user');
            
            await setDoc(userRef, {
              email: user.email,
              photoURL: user.photoURL,
              lastLogin: serverTimestamp(),
              role: currentRole
            }, { merge: true });
          }
        } catch (err) {
          console.error("Error updating user record:", err);
        }
      }

      // Basic Redirection for Login Page
      if (user && location.pathname === '/login') {
        navigate('/home', { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate, location.pathname]);

  return (
    <>
      <div className={`transition-all duration-300 min-h-screen bg-[#0A0A0A] text-gray-200 overflow-hidden`}>
        <div key={location.pathname} className="animate-[fadeInUp_0.4s_ease-out_forwards] w-full min-h-screen origin-top">
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/executive-report/team-vitals" element={<ExecutiveReportPage />} />
          <Route path="/executive-report/hourly-trends" element={<HourlyTrendsPage />} />
          <Route path="/pda-manual" element={<PdaManualPage />} />
          <Route path="/executive-plan" element={<ExecutivePlanPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/procesos" element={
              <PermissionGuard section="canViewTraining">
                <ProcessPage />
              </PermissionGuard>
            } />
            <Route path="/quizzes" element={
              <PermissionGuard section="canViewQuizzes">
                <QuizPage />
              </PermissionGuard>
            } />
            <Route path="/acw" element={
              <PermissionGuard section="canViewACW">
                <AcwPractice />
              </PermissionGuard>
            } />
            <Route path="/idle-tracker" element={
              <PermissionGuard section="canViewIdle">
                <IdleTrackerRecord />
              </PermissionGuard>
            } />
            <Route path="/mis-chats" element={
              <PermissionGuard section="canViewChats">
                <AgentChats />
              </PermissionGuard>
            } />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              } 
            /> 
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </div>
      </div>
      {showNavbar && <FloatingNav />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <PermissionsProvider>
        <Layout />
      </PermissionsProvider>
    </BrowserRouter>
  );
}

export default App;
