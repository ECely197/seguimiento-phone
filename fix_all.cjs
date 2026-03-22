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

// AcwPractice.tsx
replaceInFile('src/pages/AcwPractice.tsx', [
  [
    `      await addDoc(collection(db, 'acw_attempts'), {`,
    `      await addDoc(getUserCollection(user?.uid ?? ('guest_' + crypto.randomUUID().slice(0, 8)), 'acw_attempts'), {`
  ]
]);

// QuizPage.tsx
replaceInFile('src/pages/QuizPage.tsx', [
  [
    `query(collection(db, 'resultados_quizzes'), where('agentEmail', '==', user.email))`,
    `query(getUserCollection(user.uid, 'resultados_quizzes'))`
  ],
  [
    `await addDoc(collection(db, 'resultados_quizzes'), {`,
    `await addDoc(getUserCollection(uidTemp, 'resultados_quizzes'), {`
  ],
  [
    `ref(storage, path)`,
    `getAppStorageRef(path)`
  ]
]);

// AdminDashboard.tsx
replaceInFile('src/pages/AdminDashboard.tsx', [
  [
    `ref(storage, \`content/\${Date.now()}_\${file.name}\`)`,
    `getAppStorageRef(\`content/\${Date.now()}_\${file.name}\`)`
  ],
  [
    `ref(storage, url)`,
    `getAppStorageRef(url)`
  ],
  [
    `ref(storage, \`quizzes/audio/\${Date.now()}_\${quizAudio.name}\`)`,
    `getAppStorageRef(\`quizzes/audio/\${Date.now()}_\${quizAudio.name}\`)`
  ]
]);

// AdminProcessUpload.tsx
replaceInFile('src/pages/AdminProcessUpload.tsx', [
  [
    `ref(storage, \`processes/\${Date.now()}_\${file.name}\`)`,
    `getAppStorageRef(\`processes/\${Date.now()}_\${file.name}\`)`
  ]
]);

// AdminQuizEditor.tsx
replaceInFile('src/pages/AdminQuizEditor.tsx', [
  [
    `ref(storage, storePath)`,
    `getAppStorageRef(storePath)`
  ]
]);

// AdminQuizManager.tsx
replaceInFile('src/pages/AdminQuizManager.tsx', [
  [
    `ref(storage, quiz.audioUrl)`,
    `getAppStorageRef(quiz.audioUrl)`
  ],
  [
    `ref(storage, \`quizzes/audio/\${Date.now()}_\${newAudioFile.name}\`)`,
    `getAppStorageRef(\`quizzes/audio/\${Date.now()}_\${newAudioFile.name}\`)`
  ],
  [
    `ref(storage, editingQuiz.audioUrl)`,
    `getAppStorageRef(editingQuiz.audioUrl)`
  ]
]);

// AdminAcwManager.tsx
replaceInFile('src/pages/AdminAcwManager.tsx', [
  [
    `ref(storage, storagePath)`,
    `getAppStorageRef(storagePath)`
  ],
  [
    `ref(storage, s.storagePath)`,
    `getAppStorageRef(s.storagePath)`
  ]
]);
