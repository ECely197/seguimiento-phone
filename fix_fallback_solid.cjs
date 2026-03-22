const fs = require('fs');

let paths = fs.readFileSync('src/firebasePaths.ts', 'utf8');

paths = paths.replace(/export const getDocsWithFallback =[\s\S]*/, '');

  const addFn = `
export const getDocsWithFallback = async (collectionName: string, ...queryConstraints: any[]) => {
  const { getDocs, query, collection } = await import('firebase/firestore');
  const path1 = getPublicCollection(collectionName);
  console.log(\`[Firebase] Buscando inicialmente en: artifacts/\${appId}/public/data/\${collectionName}\`);
  
  let snap;
  try {
      if (queryConstraints.length > 0) {
          snap = await getDocs(query(path1, ...queryConstraints));
      } else {
          snap = await getDocs(path1);
      }
      
      if (!snap || snap.empty) {
         console.warn(\`[Firebase] La colección artifacts/\${appId}/.../\${collectionName} está vacía o falló. Rescatando datos desde la ruta antigua raíz: /\${collectionName}\`);
         const oldPath = collection(db, collectionName);
         if (queryConstraints.length > 0) {
             snap = await getDocs(query(oldPath, ...queryConstraints));
         } else {
             snap = await getDocs(oldPath);
         }
         console.log(\`[Firebase] Se encontraron \${snap ? snap.size : 0} rescates en /\${collectionName}\`);
      } else {
         console.log(\`[Firebase] Se encontraron \${snap.size} documentos en public/data/\${collectionName}\`);
      }
  } catch(e) {
      console.error(\`[Firebase] Error estricto en \${collectionName}, yendo al respaldo:\`, e);
      const oldPath = collection(db, collectionName);
      if (queryConstraints.length > 0) {
          snap = await getDocs(query(oldPath, ...queryConstraints));
      } else {
          snap = await getDocs(oldPath);
      }
      console.log(\`[Firebase] Se encontraron \${snap ? snap.size : 0} rescates preventivos en /\${collectionName}\`);
  }
  
  return snap;
};
`;
paths = paths + '\n' + addFn;
fs.writeFileSync('src/firebasePaths.ts', paths, 'utf8');

// 1. ProcessPage.tsx fixes
let processPage = fs.readFileSync('src/pages/ProcessPage.tsx', 'utf8');
processPage = processPage.replace(
  /const querySnapshot = await getDocs\(getPublicCollection\('processes'\)\);/,
  'const { getDocsWithFallback } = await import("../firebasePaths");\n         const querySnapshot = await getDocsWithFallback("processes");'
);
if (!processPage.includes('const user = auth.currentUser;')) {
   processPage = processPage.replace('export default function ProcessPage() {', 'export default function ProcessPage() {\n  const user = auth.currentUser;');
}
if (!processPage.includes('if (!user) return;')) {
   processPage = processPage.replace('const fetchMateriales = async () => {', 'const fetchMateriales = async () => {\nif (!user) return;');
}
if (!processPage.includes('Buscando capacitaciones')) {
   processPage = processPage.replace(/<span className="ml-2 text-m3-secondary">Cargando procesos...<\/span>/g, '<span className="ml-2 text-m3-secondary">Buscando capacitaciones en artifacts/appId...</span>');
}
fs.writeFileSync('src/pages/ProcessPage.tsx', processPage, 'utf8');

// 2. QuizPage.tsx fixes
let quizPage = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');
quizPage = quizPage.replace(
  /const snap = await getDocs\(getPublicCollection\('quizzes'\)\);/,
  'const { getDocsWithFallback } = await import("../firebasePaths");\n        const snap = await getDocsWithFallback("quizzes");'
);
fs.writeFileSync('src/pages/QuizPage.tsx', quizPage, 'utf8');

// 3. AcwPractice.tsx fixes
let acwPage = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
acwPage = acwPage.replace(
  /const q = query\(getPublicCollection\('acw_scenarios'\), orderBy\('createdAt', 'asc'\)\);\n\s*const snap = await getDocs\(q\);/,
  'const { getDocsWithFallback } = await import("../firebasePaths");\n      const snap = await getDocsWithFallback("acw_scenarios", orderBy("createdAt", "asc"));'
);
fs.writeFileSync('src/pages/AcwPractice.tsx', acwPage, 'utf8');

console.log("Updated fallback system with full query constraints, robust rules bypass rescue, and specific loader texts.");
