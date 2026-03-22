const fs = require('fs');

// We need an enhanced getPublicCollectionWithFallback helper in firebasePaths.ts instead of writing it everywhere
let paths = fs.readFileSync('src/firebasePaths.ts', 'utf8');

if (!paths.includes('getDocsWithFallback')) {
  const addFn = `
export const getDocsWithFallback = async (collectionName: string) => {
  const { getDocs, query, orderBy } = await import('firebase/firestore');
  const path1 = getPublicCollection(collectionName);
  console.log(\`[Firebase] Buscando inicialmente en: \${path1.path}\`);
  let snap = await getDocs(path1);
  
  if (snap.empty) {
     console.warn(\`[Firebase] La colección \${path1.path} está vacía. Rescatando datos desde la ruta antigua raíz: /\${collectionName}\`);
     const oldPath = collection(db, collectionName);
     snap = await getDocs(oldPath);
     console.log(\`[Firebase] Se encontraron \${snap.size} rescates en /\${collectionName}\`);
  } else {
     console.log(\`[Firebase] Se encontraron \${snap.size} documentos en \${path1.path}\`);
  }
  
  return snap;
};
`;
  paths = paths + '\n' + addFn;
  fs.writeFileSync('src/firebasePaths.ts', paths, 'utf8');
}

// 1. ProcessPage.tsx fixes
let processPage = fs.readFileSync('src/pages/ProcessPage.tsx', 'utf8');

processPage = processPage.replace(
  'const querySnapshot = await getDocs(getPublicCollection(\'processes\'));',
  'const { getDocsWithFallback } = await import("../firebasePaths");\n         const querySnapshot = await getDocsWithFallback("processes");'
);

if (!processPage.includes('const user = auth.currentUser;')) {
   processPage = processPage.replace('export default function ProcessPage() {', 'export default function ProcessPage() {\n  const user = auth.currentUser;');
}
if (!processPage.includes('if (!user) return;')) {
   processPage = processPage.replace('const fetchMateriales = async () => {', 'if (!user) return;\n    const fetchMateriales = async () => {');
}
processPage = processPage.replace('Buscando procesos...', 'Buscando capacitaciones en artifacts/appId/public/data/processes ...');
processPage = processPage.replace('setLoading(true);', 'setLoading(true);');
fs.writeFileSync('src/pages/ProcessPage.tsx', processPage, 'utf8');

// 2. QuizPage.tsx fixes
let quizPage = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');
quizPage = quizPage.replace(
  'const snap = await getDocs(getPublicCollection(\'quizzes\'));',
  'const { getDocsWithFallback } = await import("../firebasePaths");\n        const snap = await getDocsWithFallback("quizzes");'
);
fs.writeFileSync('src/pages/QuizPage.tsx', quizPage, 'utf8');

// 3. AcwPractice.tsx fixes
let acwPage = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
acwPage = acwPage.replace(
  'const q = query(getPublicCollection(\'acw_scenarios\'), orderBy(\'createdAt\', \'asc\'));\n      const snap = await getDocs(q);',
  'const { getDocsWithFallback } = await import("../firebasePaths");\n      const snap = await getDocsWithFallback("acw_scenarios"); // TODO orderBy'
);
fs.writeFileSync('src/pages/AcwPractice.tsx', acwPage, 'utf8');

console.log("Updated pages with fallback fetching");
