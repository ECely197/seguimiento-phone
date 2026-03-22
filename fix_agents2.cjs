const fs = require('fs');

let doc = fs.readFileSync('src/pages/AdminAgents.tsx', 'utf8');

doc = doc.replace("const qQuizzes = query(fetchAllUsersSubcollection('resultados_quizzes'), where('agentEmail', '==', email));", "const qQuizzes = {} as any; // placeholder");
doc = doc.replace("const snapQuizzes = await getDocs(qQuizzes);", "const snapQuizzes = { docs: [] } as any; // placeholder");
doc = doc.replace("const qAcw     = query(fetchAllUsersSubcollection('acw_attempts'), where('userEmail', '==', email));", "const qAcw = {} as any; // placeholder");
doc = doc.replace("const snapAcw     = await getDocs(qAcw);", "const snapAcw = { docs: [] } as any; // placeholder");
doc = doc.replace("setAgentResults(snapQuizzes.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() })));", 
  `const allQ = await fetchAllUsersSubcollection('resultados_quizzes'); setAgentResults(allQ.filter((r: any) => r.agentEmail === email));`
);
doc = doc.replace("setAgentAcw(snapAcw.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() })));", 
  `const allAcw = await fetchAllUsersSubcollection('acw_attempts'); setAgentAcw(allAcw.filter((r: any) => r.userEmail === email));`
);

fs.writeFileSync('src/pages/AdminAgents.tsx', doc);

let acwDoc = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
if(!acwDoc.includes('setDoc,')) {
    acwDoc = acwDoc.replace("import { collection,", "import { collection, setDoc,");
    fs.writeFileSync('src/pages/AcwPractice.tsx', acwDoc);
}
