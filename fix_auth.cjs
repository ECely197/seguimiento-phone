const fs = require('fs');
const glob = require('glob');

const wrapEffectWithAuth = (file) => {
  let c = fs.readFileSync(file, 'utf8');

  // Identify useEffect(() => { ... }, []); where there's a fetch or getDocs
  // This is a bit complex for a regex, so I'll write specific replaces for known files.
  
  if (file.includes('QuizPage.tsx')) {
    c = c.replace(
      `useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchQuizzes(), fetchUserData()]);
      setLoading(false);
    };
    init();
  }, []);`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const init = async () => {
        setLoading(true);
        await Promise.all([fetchQuizzes(), fetchUserData()]);
        setLoading(false);
      };
      init();
    });
    return () => unsubscribe();
  }, []);`
    );
    if (!c.includes('onAuthStateChanged')) {
        c = c.replace("import { auth, storage", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { auth, storage");
    }
  }

  if (file.includes('ProcessPage.tsx')) {
    c = c.replace(
      `useEffect(() => {
        loadProcesses();
    }, []);`,
      `useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
           if (!user) return;
           loadProcesses();
        });
        return () => unsubscribe();
    }, []);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { db,", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { db,");
  }

  if (file.includes('AcwPractice.tsx')) {
    c = c.replace(
      `useEffect(() => {
    fetchScenarios();
  }, []);`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      fetchScenarios();
    });
    return () => unsubscribe();
  }, []);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { db,", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { db,");
  }
  
  if (file.includes('AdminUsers.tsx')) {
    c = c.replace(
      `useEffect(() => {
    fetchUsers();
  }, []);`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      fetchUsers();
    });
    return () => unsubscribe();
  }, []);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { appId", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { appId");
  }

  if (file.includes('AdminResults.tsx')) {
    c = c.replace(
      `useEffect(() => {
    fetchResults();
  }, [searchTerm]);`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      fetchResults();
    });
    return () => unsubscribe();
  }, [searchTerm]);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { db", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { db");
  }

  if (file.includes('AdminQuizAssigner.tsx')) {
    c = c.replace(
      `useEffect(() => {
    fetchAssignments();
  }, [searchTerm]);`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      fetchAssignments();
    });
    return () => unsubscribe();
  }, [searchTerm]);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { appId", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { appId");
  }
  
  if (file.includes('AdminProcessUpload.tsx')) {
    c = c.replace(
      `useEffect(() => {
        fetchProcesses();
        fetchUsers();
    }, []);`,
      `useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            fetchProcesses();
            fetchUsers();
        });
        return () => unsubscribe();
    }, []);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { appId", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { appId");
  }
  
  if (file.includes('AdminQuizManager.tsx')) {
    c = c.replace(
      `useEffect(() => {
        fetchQuizzes();
    }, [searchTerm, selectedCategory]);`,
      `useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
           if (!user) return;
           fetchQuizzes();
        });
        return () => unsubscribe();
    }, [searchTerm, selectedCategory]);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { db", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { db");
  }
  
  if (file.includes('AdminAcwManager.tsx')) {
    c = c.replace(
      `useEffect(() => {
    fetchScenarios();
  }, []);`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      fetchScenarios();
    });
    return () => unsubscribe();
  }, []);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { db", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { db");
  }

  if (file.includes('AdminDashboard.tsx')) {
    c = c.replace(
      `useEffect(() => {
    const fetchContent = async () => {`,
      `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const fetchContent = async () => {`
    );
    c = c.replace(
      `fetchContent();\n  }, []);`,
      `fetchContent();\n    });\n    return () => unsubscribe();\n  }, []);`
    );
    if(!c.includes('onAuthStateChanged')) c = c.replace("import { auth", "import { onAuthStateChanged } from 'firebase/auth';\\nimport { auth");
  }

  // Remove the old checking !user out of QuizPage.tsx to allow anonymous fetching
  if (file.includes('QuizPage.tsx')) {
    c = c.replace(/if \(!user\.email\) return;/g, '');
    c = c.replace(/if \(!user\) \{\s*\/\/ Modo Invitado.*?\n\s*setAccuracy\(null\);\n\s*\}\n/gs, '');
  }

  fs.writeFileSync(file, c, 'utf8');
}

[
  'src/pages/QuizPage.tsx',
  'src/pages/ProcessPage.tsx',
  'src/pages/AcwPractice.tsx',
  'src/pages/AdminUsers.tsx',
  'src/pages/AdminResults.tsx',
  'src/pages/AdminQuizAssigner.tsx',
  'src/pages/AdminProcessUpload.tsx',
  'src/pages/AdminQuizManager.tsx',
  'src/pages/AdminAcwManager.tsx',
  'src/pages/AdminDashboard.tsx'
].forEach(wrapEffectWithAuth);

// Replace Anonymous Auth Logic explicitly in App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('signInAnonymously')) {
   app = app.replace("import { onAuthStateChanged }", "import { onAuthStateChanged, signInAnonymously, signInWithCustomToken }");
   app = app.replace("import { ADMIN_UID } from './constants';", "import { ADMIN_UID } from './constants';\n\ndeclare const __initial_auth_token: string | undefined;");
   app = app.replace("const showNavbar = !PUBLIC_NO_NAV.includes(location.pathname);", 
      `const showNavbar = !PUBLIC_NO_NAV.includes(location.pathname);
      
  const [authInit, setAuthInit] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error('Auth initialization error', e);
      } finally {
        setAuthInit(true);
      }
    };
    initAuth();
  }, []);
`);
   app = app.replace("return (\n    <>", "if (!authInit) return <div>Loading Auth...</div>;\n\n  return (\n    <>");
   if (!app.includes('useState')) {
       app = app.replace("import { useEffect }", "import { useEffect, useState }");
   }
   fs.writeFileSync('src/App.tsx', app, 'utf8');
}
