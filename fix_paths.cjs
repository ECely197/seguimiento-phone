const fs = require('fs');

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  for (let [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
    }
  }
  fs.writeFileSync(file, content, 'utf8');
}

// 1. AdminResults.tsx
let adminResults = fs.readFileSync('src/pages/AdminResults.tsx', 'utf8');
// Fix Result interface
adminResults = adminResults.replace('audioUrl?: string;\n}', 'audioUrl?: string;\n    path?: string;\n}');
// Fix params
adminResults = adminResults.replace(`const handleDelete = async (resultId: string) => {`, `const handleDelete = async (result: any) => {`);
adminResults = adminResults.replace(`await deleteDoc(doc(db, 'resultados_quizzes', resultId));`, `await deleteDoc(doc(db, result.path));`);
adminResults = adminResults.replace(`setResults(prev => prev.filter(r => r.id !== resultId));`, `setResults(prev => prev.filter(r => r.id !== result.id));`);
adminResults = adminResults.replace(`onClick={() => handleDelete(r.id)}`, `onClick={() => handleDelete(r)}`);
fs.writeFileSync('src/pages/AdminResults.tsx', adminResults, 'utf8');


// 2. AdminAgents.tsx
let adminAgents = fs.readFileSync('src/pages/AdminAgents.tsx', 'utf8');
adminAgents = adminAgents.replace(
  `setAgentResults(snapQuizzes.docs.map(d => ({ id: d.id, ...d.data() })));`,
  `setAgentResults(snapQuizzes.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() })));`
);
adminAgents = adminAgents.replace(
  `setAgentAcw(snapAcw.docs.map(d => ({ id: d.id, ...d.data() })));`,
  `setAgentAcw(snapAcw.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() })));`
);
adminAgents = adminAgents.replace(
  `const deleteResult = async (id: string) => {`,
  `const deleteResult = async (r: any) => {`
);
adminAgents = adminAgents.replace(
  `await deleteDoc(doc(db, 'resultados_quizzes', id));`,
  `await deleteDoc(doc(db, r.path));`
);
adminAgents = adminAgents.replace(
  `setAgentResults(prev => prev.filter(r => r.id !== id));`,
  `setAgentResults(prev => prev.filter(res => res.id !== r.id));`
);
adminAgents = adminAgents.replace(
  `onClick={() => deleteResult(r.id)}`,
  `onClick={() => deleteResult(r)}`
);
adminAgents = adminAgents.replace(
  `const handleUpdateReviewStatus = async (resultId: string, newStatus: 'approved' | 'rejected') => {`,
  `const handleUpdateReviewStatus = async (r: any, newStatus: 'approved' | 'rejected') => {`
);
adminAgents = adminAgents.replace(
  `await updateDoc(doc(db, 'resultados_quizzes', resultId), {`,
  `await updateDoc(doc(db, r.path), {`
);
adminAgents = adminAgents.replace(
  `setAgentResults(prev => prev.map(r => r.id === resultId ? { ...r, reviewStatus: newStatus } : r));`,
  `setAgentResults(prev => prev.map(res => res.id === r.id ? { ...res, reviewStatus: newStatus } : res));`
);
// Replace multiple occurrences of the update button calls using a global regex
adminAgents = adminAgents.replace(/handleUpdateReviewStatus\(r\.id, /g, `handleUpdateReviewStatus(r, `);
fs.writeFileSync('src/pages/AdminAgents.tsx', adminAgents, 'utf8');

// 3. ProcessCard.tsx
let processCard = fs.readFileSync('src/components/ProcessCard.tsx', 'utf8');
if (!processCard.includes('getPublicDoc')) {
  processCard = processCard.replace(`import { auth, db } from '../firebaseConfig';`, `import { auth, db } from '../firebaseConfig';\nimport { getPublicDoc } from '../firebasePaths';`);
}
processCard = processCard.replace(`const docRef = doc(db, 'processes', id);`, `const docRef = getPublicDoc('processes', id);`);
fs.writeFileSync('src/components/ProcessCard.tsx', processCard, 'utf8');
