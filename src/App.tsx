import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProcessPage from './pages/ProcessPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import AcwPractice from './pages/AcwPractice';
import ExecutiveReportPage from './pages/ExecutiveReportPage';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Header from './components/Header';
import './App.css';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, db } from './firebaseConfig';
import { ADMIN_UID } from './constants';

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Hide navbar on login page AND admin dashboard
  const PUBLIC_NO_NAV = ['/login', '/admin', '/', '/executive-report/team-vitals'];
  const showNavbar = !PUBLIC_NO_NAV.includes(location.pathname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      let currentRole = null;

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            currentRole = 'user';
            if (user.uid === ADMIN_UID) currentRole = 'admin';

            await setDoc(userRef, {
              email: user.email,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              role: currentRole
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
      {showNavbar && <Header />}
      <div className={`${showNavbar ? "pb-20 pt-16" : ""} transition-all duration-300`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/executive-report/team-vitals" element={<ExecutiveReportPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/procesos" element={<ProcessPage />} />
            <Route path="/quizzes" element={<QuizPage />} />
            <Route path="/acw" element={<AcwPractice />} />
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
      {showNavbar && <Navbar />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
