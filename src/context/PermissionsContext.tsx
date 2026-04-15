import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { getDoc } from 'firebase/firestore';
import { getUserDoc, getPublicDoc } from '../firebasePaths';
import { onAuthStateChanged } from 'firebase/auth';

interface Permissions {
  capacitaciones: boolean;
  quizzes: boolean;
  acw: boolean;
  idle_tracker: boolean;
  metrics: boolean;
}

interface PermissionsContextType {
  userLOB: string | null;
  permissions: Permissions;
  lobApiUrl: string | null;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: Permissions = {
  capacitaciones: true,
  quizzes: true,
  acw: true,
  idle_tracker: true,
  metrics: true
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
          // 1. Get user LOB
          const userSnap = await getDoc(getUserDoc(user.uid));
          let lob = 'phone'; // default if not found
          if (userSnap.exists()) {
            lob = userSnap.data().lob?.toLowerCase() || 'phone';
          }
          setUserLOB(lob);

          // 2. Get LOB Configuration (Dynamic)
          const lobConfigSnap = await getDoc(getPublicDoc('lobs', lob));
          
          if (lobConfigSnap.exists()) {
            const data = lobConfigSnap.data();
            setPermissions({
              ...DEFAULT_PERMISSIONS,
              ...(data.permissions || {})
            });
            setLobApiUrl(data.apiUrl || null);
          } else {
            // Fallback: Check legacy Visibility Matrix
            const configSnap = await getDoc(getPublicDoc('module_config', 'visibility_matrix'));
            if (configSnap.exists()) {
              const matrix = configSnap.data();
              if (matrix[lob]) {
                setPermissions({ ...DEFAULT_PERMISSIONS, ...matrix[lob] });
              } else {
                setPermissions(DEFAULT_PERMISSIONS);
              }
            } else {
              setPermissions(DEFAULT_PERMISSIONS);
            }
            setLobApiUrl(null);
          }
        } catch (error) {
          console.error("Error loading permissions:", error);
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
