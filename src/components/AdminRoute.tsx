import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Loader2 } from 'lucide-react';
import { ADMIN_UID } from '../constants'; // Fallback for hardcoded super-admin

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
            // Check Firestore for role
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.role === 'admin' || data.isAdmin === true || currentUser.uid === ADMIN_UID) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }
            } else if (currentUser.uid === ADMIN_UID) {
                // Fallback for new admin users not yet in DB
                setIsAdmin(true);
            } else {
                setIsAdmin(false);
            }
        } catch (error) {
            console.error("Error verifying admin role:", error);
            setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1C1E]">
        <Loader2 className="animate-spin text-m3-primary" size={48} />
      </div>
    );
  }

  if (!user) {
      return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
     // User is logged in but not admin -> Redirect to Training/Home
     return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
