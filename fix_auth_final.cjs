const fs = require('fs');

function updateFile(file, replacer) {
  let c = fs.readFileSync(file, 'utf8');
  let original = c;
  c = replacer(c);
  if (c !== original) {
    fs.writeFileSync(file, c, 'utf8');
    console.log('Updated', file);
  }
}

// 1. App.tsx
updateFile('src/App.tsx', c => {
  let res = c;
  if (!res.includes('signInAnonymously')) {
     res = res.replace("import { onAuthStateChanged }", "import { onAuthStateChanged, signInAnonymously, signInWithCustomToken }");
  }
  if (!res.includes('useState')) {
     res = res.replace("import { useEffect }", "import { useEffect, useState }");
  }
  if (!res.includes('__initial_auth_token')) {
     res = res.replace("import { ADMIN_UID } from './constants';", "import { ADMIN_UID } from './constants';\n\ndeclare const __initial_auth_token: string | undefined;");
  }
  if (!res.includes('authInitialized')) {
     res = res.replace("const showNavbar = !PUBLIC_NO_NAV.includes(location.pathname);", 
      `const showNavbar = !PUBLIC_NO_NAV.includes(location.pathname);
      
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setAuthInitialized(true);
      }
    };
    initAuth();
  }, []);
`);
     res = res.replace("return (\n    <>", "if (!authInitialized) { return <div className=\\"min-h-screen flex items-center justify-center\\"><div className=\\"animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500\\"></div></div>; }\n\n  return (\n    <>");
  }
  return res;
});

// Since the prompt explicitly says "En todos los useEffect que usan onSnapshot o getDocs, agrega la guardia: if (!user) return;. Asegúrate de que user sea una dependencia del useEffect."
// I will inject it at the top of every Page component: `const user = auth.currentUser;`
// And replace `useEffect(() => { ... }, []);` with `useEffect(() => { if (!user) return; ... }, [user]);`

const replaceEffects = (file, effectMatch, initCallMatches) => {
   updateFile(file, c => {
       // Insert `const user = auth.currentUser;` at the beginning of the component if absent.
       if (!c.includes('const user = auth.currentUser;')) {
           c = c.replace(/export default function (\w+)\(\) \{/, "export default function $1() {\n  const user = auth.currentUser;\n");
       }
       
       // Handle standard empty dependency effects
       c = c.replace(/useEffect\(\(\) => \{\n\s+([A-Za-z0-9_]+)\(\);\n\s+\}, \[\]\);/g, "useEffect(() => {\n    if (!user) return;\n    $1();\n  }, [user]);");
       // Handle async inline effects
       c = c.replace(/useEffect\(\(\) => \{\n\s+const (\w+) = async \(\) => \{\n(.*?)(\n\s+)?\}\n\s+init\(\);\n\s+\}, \[\]\);/gs, "useEffect(() => {\n    if (!user) return;\n    const $1 = async () => {\n$2$3}\n    $1();\n  }, [user]);");
       
       return c;
   });
}

// 2. AcwPractice.tsx
updateFile('src/pages/AcwPractice.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AcwPractice() {", "export default function AcwPractice() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchScenarios\(\);\n\s+\}, \[\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchScenarios();\n  }, [user]);"
  );
  return c;
});

// 3. ProcessPage.tsx
updateFile('src/pages/ProcessPage.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function ProcessPage() {", "export default function ProcessPage() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+loadProcesses\(\);\n\s+\}, \[\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    loadProcesses();\n  }, [user]);"
  );
  return c;
});

// 4. AdminUsers.tsx
updateFile('src/pages/AdminUsers.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminUsers() {", "export default function AdminUsers() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchUsers\(\);\n\s+\}, \[\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchUsers();\n  }, [user]);"
  );
  return c;
});

// 5. AdminQuizAssigner.tsx
updateFile('src/pages/AdminQuizAssigner.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminQuizAssigner() {", "export default function AdminQuizAssigner() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchAssignments\(\);\n\s+\}, \[searchTerm\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchAssignments();\n  }, [searchTerm, user]);"
  );
  return c;
});

// 6. AdminProcessUpload.tsx
updateFile('src/pages/AdminProcessUpload.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminProcessUpload() {", "export default function AdminProcessUpload() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchProcesses\(\);\n\s+fetchUsers\(\);\n\s+\}, \[\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchProcesses();\n    fetchUsers();\n  }, [user]);"
  );
  return c;
});

// 7. AdminAcwManager.tsx
updateFile('src/pages/AdminAcwManager.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminAcwManager() {", "export default function AdminAcwManager() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchScenarios\(\);\n\s+\}, \[\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchScenarios();\n  }, [user]);"
  );
  return c;
});


// 8. QuizPage.tsx 
updateFile('src/pages/QuizPage.tsx', c => {
  // Remove manual guest check because guests are anonymously logged in now
  c = c.replace(/if \(!user\.email\) return;\r?\n/g, '');
  c = c.replace(/if \(!user\) \{\r?\n\s*\/\/ Modo Invitado.*?\r?\n\s*setAccuracy\(null\);\r?\n\s*\}\r?\n/gs, '');

  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function QuizPage() {", "export default function QuizPage() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+const init = async \(\) => \{\n\s+setLoading\(true\);\n\s+await Promise\.all\(\[fetchQuizzes\(\), fetchUserData\(\)\]\);\n\s+setLoading\(false\);\n\s+\};\n\s+init\(\);\n\s+\}, \[\]\);/gs,
    "useEffect(() => {\n    if (!user) return;\n    const init = async () => {\n      setLoading(true);\n      await Promise.all([fetchQuizzes(), fetchUserData()]);\n      setLoading(false);\n    };\n    init();\n  }, [user]);"
  );
  
  // also in fetchUserData it checked const user = auth.currentUser, remove shadowing
  c = c.replace(/const user = auth.currentUser;/g, '');
  c = c.replace("export default function QuizPage() {", "export default function QuizPage() {\n  const user = auth.currentUser;");
  return c;
});

// 9. AdminResults.tsx
updateFile('src/pages/AdminResults.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminResults() {", "export default function AdminResults() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchResults\(\);\n\s+\}, \[searchTerm\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchResults();\n  }, [searchTerm, user]);"
  );
  return c;
});

// 10. AdminQuizManager.tsx
updateFile('src/pages/AdminQuizManager.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminQuizManager() {", "export default function AdminQuizManager() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+fetchQuizzes\(\);\n\s+\}, \[searchTerm, selectedCategory\]\);/g,
    "useEffect(() => {\n    if (!user) return;\n    fetchQuizzes();\n  }, [searchTerm, selectedCategory, user]);"
  );
  return c;
});

// 11. AdminDashboard.tsx
updateFile('src/pages/AdminDashboard.tsx', c => {
  if (!c.includes('const user = auth.currentUser;')) {
      c = c.replace("export default function AdminDashboard() {", "export default function AdminDashboard() {\n  const user = auth.currentUser;");
  }
  c = c.replace(
    /useEffect\(\(\) => \{\n\s+const fetchContent = async \(\) => \{/s,
    "useEffect(() => {\n    if (!user) return;\n    const fetchContent = async () => {"
  );
  c = c.replace(
    /fetchContent\(\);\n\s+\}, \[\]\);/s,
    "fetchContent();\n  }, [user]);"
  );
  return c;
});

