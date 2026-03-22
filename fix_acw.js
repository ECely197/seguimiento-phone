const fs = require('fs');

let content = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
content = content.replace(
  "getUserCollection(userId, 'acw_attempts')",
  "getUserCollection((auth.currentUser?.uid ?? ('guest_' + crypto.randomUUID().slice(0, 8))), 'acw_attempts')"
);
fs.writeFileSync('src/pages/AcwPractice.tsx', content, 'utf8');

// Same for QuizPage
let qContent = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');
qContent = qContent.replace(
  "query(collection(db, 'resultados_quizzes'), where('agentEmail', '==', user.email))",
  "query(getUserCollection(user.uid, 'resultados_quizzes'))"
);
// Also QuizPage addDoc
qContent = qContent.replace(
  "addDoc(collection(db, 'resultados_quizzes'), {",
  "addDoc(getUserCollection(userId, 'resultados_quizzes'), {"
);

fs.writeFileSync('src/pages/QuizPage.tsx', qContent, 'utf8');
