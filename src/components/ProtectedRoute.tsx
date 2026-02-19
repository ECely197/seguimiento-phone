import { ADMIN_UID } from '../constants';

import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1C1E]">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  // Check if user is logged in AND is the admin
  if (!user || user.uid !== ADMIN_UID) {
     // If not logged in -> /, if logged in but not admin -> /home
     return <Navigate to={user ? "/home" : "/"} replace />;
  }

  return <>{children}</>;
}
