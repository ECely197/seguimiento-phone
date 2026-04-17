import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, appId } from '../firebaseConfig';
import { getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Permissions {
  canViewTraining: boolean;
  canViewQuizzes: boolean;
  canViewACW: boolean;
  canViewMetrics: boolean;
  canViewIdle: boolean;
  canViewChats: boolean;
}

interface PermissionsContextType {
  userLOB: string | null;
  permissions: Permissions;
  lobApiUrl: string | null;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: Permissions = {
  canViewTraining: true,
  canViewQuizzes: true,
  canViewACW: true,
  canViewMetrics: true,
  canViewIdle: true,
  canViewChats: false
};

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLOB, setUserLOB] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [lobApiUrl, setLobApiUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        try {
          // 1. Get user LOB record from /artifacts/{appId}/users/{uid}
          const userSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid));
          let lob = 'phone'; 
          if (userSnap.exists()) {
            lob = userSnap.data().lob?.toLowerCase() || 'phone';
          }
          setUserLOB(lob);

          // 2. Get LOB Configuration from /artifacts/{appId}/public/data/lobs/{lob}
          const lobConfigSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lobs', lob));
          
          if (lobConfigSnap.exists()) {
            const data = lobConfigSnap.data();
            const perms = data.permissions || {};
            
            // Map legacy fields to new fields if necessary for compatibility
            setPermissions({
              canViewTraining: perms.canViewTraining ?? perms.capacitaciones ?? true,
              canViewQuizzes:  perms.canViewQuizzes  ?? perms.quizzes ?? true,
              canViewACW:      perms.canViewACW      ?? perms.acw ?? true,
              canViewMetrics:  perms.canViewMetrics  ?? perms.metrics ?? true,
              canViewIdle:     perms.canViewIdle     ?? perms.idle_tracker ?? true,
              canViewChats:    perms.canViewChats    ?? false,
            });
            setLobApiUrl(data.apiUrl || null);
          } else {
            // Fallback for LOBs without config document
            setPermissions(DEFAULT_PERMISSIONS);
            setLobApiUrl(null);
          }
        } catch (error) {
          console.error("Error loading permissions context:", error);
          setPermissions(DEFAULT_PERMISSIONS);
        }
      } else {
        setUserLOB(null);
        setPermissions(DEFAULT_PERMISSIONS);
        setLobApiUrl(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <PermissionsContext.Provider value={{ userLOB, permissions, lobApiUrl, loading }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
