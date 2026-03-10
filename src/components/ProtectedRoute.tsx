import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-m3-surface dark:bg-m3-surface-dark">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-m3-primary" size={48} />
            <p className="text-m3-secondary dark:text-m3-on-surface-dark animate-pulse font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // No longer redirect to /login to allow guest usage
  // if (!user) {
  //   return <Navigate to="/login" replace />;
  // }

  return children ? <>{children}</> : <Outlet />;
}
