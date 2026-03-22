const fs = require('fs');

// AcwPractice.tsx missing setDoc import
let acw = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
if (!acw.includes('setDoc,')) {
  acw = acw.replace('import { getDocs', 'import { getDocs, setDoc');
  fs.writeFileSync('src/pages/AcwPractice.tsx', acw);
}

// AdminAgents.tsx logic replacement
let agents = fs.readFileSync('src/pages/AdminAgents.tsx', 'utf8');
agents = agents.replace(/      const qQuizzes = query\(fetchAllUsersSubcollection\('resultados_quizzes'\), where\('agentEmail', '==', email\)\);\s*const snapQuizzes = await getDocs\(qQuizzes\);\s*const qAcw     = query\(fetchAllUsersSubcollection\('acw_attempts'\), where\('userEmail', '==', email\)\);\s*const snapAcw     = await getDocs\(qAcw\);\s*setAgentResults\(snapQuizzes\.docs\.map\(d => \(\{ id: d\.id, path: d\.ref\.path, \.\.\.d\.data\(\) \}\)\)\);\s*setAgentAcw\(snapAcw\.docs\.map\(d => \(\{ id: d\.id, path: d\.ref\.path, \.\.\.d\.data\(\) \}\)\)\);/ms,
  `      const allQ = await fetchAllUsersSubcollection('resultados_quizzes');
      const filteredQ = allQ.filter((r: any) => r.agentEmail === email);
      setAgentResults(filteredQ);
      const allAcw = await fetchAllUsersSubcollection('acw_attempts');
      const filteredAcw = allAcw.filter((r: any) => r.userEmail === email);
      setAgentAcw(filteredAcw);`
);

fs.writeFileSync('src/pages/AdminAgents.tsx', agents);
