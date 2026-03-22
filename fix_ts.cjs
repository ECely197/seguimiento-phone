const fs = require('fs');

// 1. AdminResults.tsx
let results = fs.readFileSync('src/pages/AdminResults.tsx', 'utf8');
results = results.replace(
  /const resultsSnap = await getDocs\(query\(fetchAllUsersSubcollection\('resultados_quizzes'\), orderBy\('timestamp', 'desc'\)\)\);[\s\S]*?const resultsData = resultsSnap\.docs\.map\(doc => \(\{ id: doc\.id, path: doc\.ref\.path, \.\.\.doc\.data\(\) \} as unknown as Result\)\);/s,
  `const allData = await fetchAllUsersSubcollection('resultados_quizzes');
      const sortedData = allData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      const resultsData = sortedData as unknown as Result[];`
);
// In case the above didn't match exactly because of fetchAllUsersSubcollection replacing getAdminCollectionGroup:
results = results.replace(
  /const resultsSnap = await getDocs\(query\(fetchAllUsersSubcollection\('resultados_quizzes'\), orderBy\('timestamp', 'desc'\)\)\);[\s\S]*?const resultsData = [^;]+;/s,
  `const allData = await fetchAllUsersSubcollection('resultados_quizzes');
      const sortedData = allData.sort((a: any, b: any) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      const resultsData = sortedData as unknown as Result[];`
);
fs.writeFileSync('src/pages/AdminResults.tsx', results, 'utf8');

// 2. ExecutiveReportPage.tsx
let exec = fs.readFileSync('src/pages/ExecutiveReportPage.tsx', 'utf8');
exec = exec.replace(/\{ docs: data\.map\(d => \(\{ data: \(\) => d \}\)\) \}/g, 
  `{ docs: data.map((d: any) => ({ id: d.id, data: () => d })) }`
);
fs.writeFileSync('src/pages/ExecutiveReportPage.tsx', exec, 'utf8');

// 3. QuizPage.tsx
let quiz = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');
if (!quiz.includes('setDoc,')) {
  quiz = quiz.replace("import { collection,", "import { collection, setDoc,");
}
fs.writeFileSync('src/pages/QuizPage.tsx', quiz, 'utf8');
