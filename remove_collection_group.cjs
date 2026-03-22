const fs = require('fs');

let paths = fs.readFileSync('src/firebasePaths.ts', 'utf8');

if (!paths.includes('fetchAllUsersSubcollection')) {
  const addFn = `
export const fetchAllUsersSubcollection = async (collectionName: string) => {
  const { getDocs, collection } = await import('firebase/firestore');
  const usersRef = collection(db, 'artifacts', envAppId, 'users');
  const usersSnap = await getDocs(usersRef);
  let allData: any[] = [];
  for (const userDoc of usersSnap.docs) {
    const subSnap = await getDocs(getUserCollection(userDoc.id, collectionName));
    subSnap.docs.forEach(d => {
      allData.push({ id: d.id, path: d.ref.path, ...d.data() });
    });
  }
  return allData;
};
`;
  paths = paths.replace(/export const getAdminCollectionGroup.*?\n/s, addFn);
  fs.writeFileSync('src/firebasePaths.ts', paths, 'utf8');
}

// Update AdminAgents.tsx
let agents = fs.readFileSync('src/pages/AdminAgents.tsx', 'utf8');
// They have:
// const qQuizzes = query(getAdminCollectionGroup('resultados_quizzes'), where('agentEmail', '==', email));
// const snapQuizzes = await getDocs(qQuizzes);
// Replace with finding the user first. Actually, just query fetchAllUsersSubcollection('resultados_quizzes') and filter by email!
agents = agents.replace(
  /const qQuizzes = query\(getAdminCollectionGroup\('resultados_quizzes'\), where\('agentEmail', '==', email\)\);\n\s*const snapQuizzes = await getDocs\(qQuizzes\);/s,
  `const allQ = await fetchAllUsersSubcollection('resultados_quizzes');
      const filteredQ = allQ.filter((r: any) => r.agentEmail === email);
      const snapQuizzes = { docs: filteredQ.map(data => ({ id: data.id, ref: { path: data.path }, data: () => data })) };`
);

agents = agents.replace(
  /const qAcw     = query\(getAdminCollectionGroup\('acw_attempts'\), where\('userEmail', '==', email\)\);\n\s*const snapAcw     = await getDocs\(qAcw\);/s,
  `const allAcw = await fetchAllUsersSubcollection('acw_attempts');
      const filteredAcw = allAcw.filter((r: any) => r.userEmail === email);
      const snapAcw = { docs: filteredAcw.map(data => ({ id: data.id, ref: { path: data.path }, data: () => data })) };`
);

fs.writeFileSync('src/pages/AdminAgents.tsx', agents, 'utf8');


// Update AdminAcwStats.tsx
let acwStats = fs.readFileSync('src/pages/AdminAcwStats.tsx', 'utf8');
acwStats = acwStats.replace(
  /const q = query\(getAdminCollectionGroup\('acw_attempts'\), orderBy\('timestamp', 'desc'\)\);\n\s*const querySnapshot = await getDocs\(q\);/s,
  `const allData = await fetchAllUsersSubcollection('acw_attempts');
        const sortedData = allData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        const querySnapshot = { docs: sortedData.map(data => ({ id: data.id, data: () => data })) };`
);
fs.writeFileSync('src/pages/AdminAcwStats.tsx', acwStats, 'utf8');


// Update AdminResults.tsx
let results = fs.readFileSync('src/pages/AdminResults.tsx', 'utf8');
results = results.replace(
  /const resultsSnap = await getDocs\(query\(getAdminCollectionGroup\('resultados_quizzes'\), orderBy\('timestamp', 'desc'\)\)\);\n\s*const resultsData = resultsSnap\.docs\.map\(doc => \(\{ id: doc\.id, path: doc\.ref\.path, \.\.\.doc\.data\(\) \} as unknown as Result\)\);/s,
  `const allData = await fetchAllUsersSubcollection('resultados_quizzes');
      const sortedData = allData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      const resultsData = sortedData as unknown as Result[];`
);
fs.writeFileSync('src/pages/AdminResults.tsx', results, 'utf8');


// Update ExecutiveReportPage.tsx
let execReport = fs.readFileSync('src/pages/ExecutiveReportPage.tsx', 'utf8');
execReport = execReport.replace(
  /getDocs\(getAdminCollectionGroup\('resultados_quizzes'\)\)/g,
  `fetchAllUsersSubcollection('resultados_quizzes').then(data => ({ docs: data.map(d => ({ data: () => d })) }))`
);
execReport = execReport.replace(
  /getDocs\(getAdminCollectionGroup\('acw_attempts'\)\)/g,
  `fetchAllUsersSubcollection('acw_attempts').then(data => ({ docs: data.map(d => ({ data: () => d })) }))`
);
fs.writeFileSync('src/pages/ExecutiveReportPage.tsx', execReport, 'utf8');

// Replace imports of getAdminCollectionGroup with fetchAllUsersSubcollection everywhere
const files = [
  'src/pages/AdminAgents.tsx',
  'src/pages/AdminAcwStats.tsx',
  'src/pages/AdminResults.tsx',
  'src/pages/ExecutiveReportPage.tsx',
  'src/pages/QuizPage.tsx',
  'src/pages/ProcessPage.tsx',
  'src/pages/AdminAcwManager.tsx',
  'src/pages/AcwPractice.tsx',
  'src/pages/AdminQuizAssigner.tsx',
  'src/pages/AdminQuizManager.tsx',
  'src/pages/AdminQuizEditor.tsx',
  'src/pages/AdminProcessUpload.tsx',
  'src/pages/AdminDashboard.tsx',
  'src/pages/AdminUsers.tsx'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/getAdminCollectionGroup/g, 'fetchAllUsersSubcollection');
  fs.writeFileSync(f, c, 'utf8');
});

// Finally, modify AcwPractice.tsx and QuizPage.tsx to setDoc on user root BEFORE addDoc
let acwPrac = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
if (!acwPrac.includes('setDoc(getUserDoc')) {
  acwPrac = acwPrac.replace(
    /await addDoc\(getUserCollection\(\(user\?\.uid \?\? \('guest_' \+ crypto\.randomUUID\(\)\.slice\(0, 8\)\)\), 'acw_attempts'\), \{/s,
    `const uidToUse = user?.uid ?? ('guest_' + crypto.randomUUID().slice(0, 8));
      await setDoc(getUserDoc(uidToUse), { 
        isGuest: isGuest, 
        email: user?.email ?? 'invitado@visitante.com', 
        name: isGuest ? 'Invitado' : (user?.displayName || ''),
        lastActivity: serverTimestamp() 
      }, { merge: true });
      await addDoc(getUserCollection(uidToUse, 'acw_attempts'), {`
  );
  acwPrac = acwPrac.replace(
    /userId: user\?\.uid \?\? \('guest_' \+ crypto\.randomUUID\(\)\.slice\(0, 8\)\),/s,
    `userId: uidToUse,`
  );
  if (!acwPrac.includes('setDoc')) {
     acwPrac = acwPrac.replace("import { collection", "import { collection, setDoc");
  }
  fs.writeFileSync('src/pages/AcwPractice.tsx', acwPrac, 'utf8');
}

let quizP = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');
if (!quizP.includes('setDoc(getUserDoc')) {
  quizP = quizP.replace(
    /await addDoc\(getUserCollection\(uidTemp, 'resultados_quizzes'\), \{/s,
    `await setDoc(getUserDoc(uidTemp), {
        isGuest: isGuest,
        email: agentEmail,
        name: isGuest ? "Invitado" : (auth.currentUser?.displayName || ""),
        lastActivity: serverTimestamp()
      }, { merge: true });
      await addDoc(getUserCollection(uidTemp, 'resultados_quizzes'), {`
  );
  if (!quizP.includes('setDoc')) {
     quizP = quizP.replace("import { collection", "import { collection, setDoc");
  }
  fs.writeFileSync('src/pages/QuizPage.tsx', quizP, 'utf8');
}

console.log("Done refactoring collectionGroup!");
