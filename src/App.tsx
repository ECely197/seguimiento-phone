import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProcessPage from './pages/ProcessPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import AdminRoute from './components/AdminRoute'; // Import
import Navbar from './components/Navbar';
import './App.css';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Added imports
import { auth, db } from './firebaseConfig';
import { ADMIN_UID } from './constants';

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Hide navbar on login page AND admin dashboard
  const showNavbar = location.pathname !== '/' && location.pathname !== '/admin';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // 1. Save/Update User in Firestore
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // New User: Set default fields + isAdmin: false
            await setDoc(userRef, {
              email: user.email,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              isAdmin: false // Default role
            });
          } else {
            // Existing User: Update lastLogin, preserve isAdmin
            await setDoc(userRef, {
              email: user.email,
              photoURL: user.photoURL,
              lastLogin: serverTimestamp()
            }, { merge: true });
          }
        } catch (err) {
          console.error("Error updating user record:", err);
        }
      }

      // 2. Navigation Logic
      // If user is logged in and currently on the Login page ('/'), redirect them
      if (user && location.pathname === '/') {
        if (user.uid === ADMIN_UID) {
           navigate('/admin');
        } else {
           navigate('/home');
        }
      } else if (!user && location.pathname !== '/') {
        // Global Protection: If not logged in and trying to access any other page, redirect to Login
        navigate('/'); 
      }
    });
    return () => unsubscribe();
  }, [navigate, location.pathname]);

  return (
    <>
      <div className={showNavbar ? "pb-20" : ""}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/procesos" element={<ProcessPage />} />
          <Route path="/quizzes" element={<QuizPage />} />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } 
          /> 
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
