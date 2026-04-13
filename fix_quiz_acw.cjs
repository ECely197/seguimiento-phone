const fs = require('fs');

// ─── AcwPractice.tsx ──────────────────────────────────────────────────────────
let acw = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');

// Replace just the inner try/finally of that specific useEffect
const ACW_OLD_INNER = `      try {
        const q = query(getPublicCollection('acw_scenarios'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        setAllScenarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcwScenario)));
      } finally {
        setLoading(false);
      }`;

const ACW_NEW_INNER = `      try {
        const { getDocs: gd, collection: col, query: q2, setDoc: sd, doc: docFn, orderBy: ob } = await import('firebase/firestore');
        const { db: fdb, appId: aid } = await import('../firebaseConfig');

        const newCol = getPublicCollection('acw_scenarios');
        const oldCol = col(fdb, 'acw_scenarios');

        console.log('[ACW] Doble Fetch: artifacts + raiz /acw_scenarios');

        const [newRes, oldRes] = await Promise.allSettled([
          gd(q2(newCol, ob('createdAt', 'asc'))),
          gd(oldCol),
        ]);

        const seenIds = new Set();
        const merged = [];
        const toMigrate = [];

        // Priority: new path first
        if (newRes.status === 'fulfilled' && !newRes.value.empty) {
          newRes.value.docs.forEach(d => {
            seenIds.add(d.id);
            merged.push({ id: d.id, ...d.data() });
          });
          console.log('[ACW] Nuevos: ' + newRes.value.size + ' escenarios.');
        }

        // Fallback/rescue from legacy root
        if (oldRes.status === 'fulfilled' && !oldRes.value.empty) {
          oldRes.value.docs.forEach(d => {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              merged.push({ id: d.id, ...d.data() });
              toMigrate.push(d);
            }
          });
          if (toMigrate.length > 0)
            console.log('[ACW] Rescatados de raiz: ' + toMigrate.length + ' escenarios.');
        }

        setAllScenarios(merged);
        console.log('[ACW] Total: ' + merged.length + ' escenarios.');

        // Auto-migrate legacy docs to new path
        if (toMigrate.length > 0) {
          Promise.allSettled(
            toMigrate.map(d => sd(docFn(fdb, 'artifacts', aid, 'public', 'data', 'acw_scenarios', d.id), d.data(), { merge: true }))
          ).then(results => {
            const ok = results.filter(r => r.status === 'fulfilled').length;
            console.log('[ACW-Migrator] Migrados ' + ok + ' escenarios a nueva ruta.');
          });
        }
      } catch (err) {
        console.error('[ACW] Error en doble fetch:', err);
      } finally {
        setLoading(false);
      }`;

if (acw.includes(ACW_OLD_INNER)) {
  acw = acw.replace(ACW_OLD_INNER, ACW_NEW_INNER);
  console.log('AcwPractice: inner try replaced OK');
} else {
  // Try CRLF
  const ACW_OLD_CRLF = ACW_OLD_INNER.split('\n').join('\r\n');
  if (acw.includes(ACW_OLD_CRLF)) {
    acw = acw.replace(ACW_OLD_CRLF, ACW_NEW_INNER);
    console.log('AcwPractice: inner try replaced OK (CRLF)');
  } else {
    console.error('AcwPractice: Could NOT find old inner try block!');
    // Print what's around line 217-222
    const lines = acw.split('\n');
    lines.slice(214, 226).forEach((l, i) => console.log((214+i) + ': ' + l));
  }
}
fs.writeFileSync('src/pages/AcwPractice.tsx', acw, 'utf8');

// ─── QuizPage.tsx ─────────────────────────────────────────────────────────────
let quiz = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');

// For authenticated user path: also do dual fetch on quizzes (not just from assignments)
// The auth'd path already has getDocsWithFallback for guest. 
// But for auth'd user, we also need to fetch legacy /quizzes and merge by IDs found in assignments.
// Currently it only checks asignaciones_quizzes for the list of IDs, then fetches those from new path only.
// New approach: fetch all quizzes from both paths (merged), then filter to assigned IDs.

const QUIZ_OLD_AUTH_BLOCK = `        // Usuario autenticado: Cargar solo lo asignado
        const assignSnap = await getDocs(
          query(getPublicCollection('asignaciones_quizzes'), where('agentEmail', '==', user.email))
        );
        const ids = assignSnap.docs.map(d => d.data().quizId);
        if (ids.length === 0) { setQuizzes([]); return; }

        for (const quizId of ids) {
          const snap = await getDocs(
            query(getPublicCollection('quizzes'), where('__name__', '==', quizId))
          );
          if (!snap.empty) {
            const d = snap.docs[0].data();
            details.push({
              id: snap.docs[0].id,
              title: d.situation || 'Contexto del Quiz',
              description: d.question || 'Pregunta no disponible',
              mediaUrl: d.mediaUrl || d.audioUrl || '',
              audioUrl: d.audioUrl || '',
              mediaType: d.mediaType || '',
              quizType: d.quizType || (d.options?.length ? 'multiple-choice' : 'open-audio'),
              options: d.options || [],
              correctOption: d.correctOption,
              explanation: d.explanation,
            });
          }
        }`;

const QUIZ_NEW_AUTH_BLOCK = `        // Usuario autenticado: Cargar desde asignaciones (nueva ruta) + raiz legacy
        const { getDocs: gd2, collection: col2, query: q3, setDoc: sd2, doc: docFn2 } = await import('firebase/firestore');
        const { db: fdb2, appId: aid2 } = await import('../firebaseConfig');

        // Fetch assignments from both new and legacy paths in parallel
        const [assignNew, assignOld] = await Promise.allSettled([
          gd2(q3(getPublicCollection('asignaciones_quizzes'), where('agentEmail', '==', user.email))),
          gd2(q3(col2(fdb2, 'asignaciones_quizzes'), where('agentEmail', '==', user.email))),
        ]);

        const assignedIds = new Set();
        if (assignNew.status === 'fulfilled') assignNew.value.docs.forEach(d => assignedIds.add(d.data().quizId));
        if (assignOld.status === 'fulfilled') assignOld.value.docs.forEach(d => assignedIds.add(d.data().quizId));

        console.log('[Quiz] IDs asignados encontrados:', assignedIds.size);

        // Now fetch all quizzes from BOTH paths (dual fetch)
        const [quizNew, quizOld] = await Promise.allSettled([
          gd2(getPublicCollection('quizzes')),
          gd2(col2(fdb2, 'quizzes')),
        ]);

        const allQuizMap = new Map();
        const quizToMigrate = [];

        if (quizNew.status === 'fulfilled') quizNew.value.docs.forEach(d => allQuizMap.set(d.id, d));
        if (quizOld.status === 'fulfilled') quizOld.value.docs.forEach(d => {
          if (!allQuizMap.has(d.id)) {
            allQuizMap.set(d.id, d);
            quizToMigrate.push(d);
          }
        });

        console.log('[Quiz] Total quizzes disponibles (ambas rutas): ' + allQuizMap.size + ', legacy a migrar: ' + quizToMigrate.length);

        // If no assignments exist, show ALL quizzes (fallback for open access)
        const targetIds = assignedIds.size > 0 ? [...assignedIds] : [...allQuizMap.keys()];

        for (const quizId of targetIds) {
          const docD = allQuizMap.get(quizId);
          if (docD) {
            const d = docD.data();
            details.push({
              id: docD.id,
              title: d.situation || 'Contexto del Quiz',
              description: d.question || 'Pregunta no disponible',
              mediaUrl: d.mediaUrl || d.audioUrl || '',
              audioUrl: d.audioUrl || '',
              mediaType: d.mediaType || '',
              quizType: d.quizType || (d.options?.length ? 'multiple-choice' : 'open-audio'),
              options: d.options || [],
              correctOption: d.correctOption,
              explanation: d.explanation,
            });
          }
        }

        // Auto-migrate legacy quizzes to new path
        if (quizToMigrate.length > 0) {
          Promise.allSettled(
            quizToMigrate.map(d => sd2(docFn2(fdb2, 'artifacts', aid2, 'public', 'data', 'quizzes', d.id), d.data(), { merge: true }))
          ).then(results => {
            const ok = results.filter(r => r.status === 'fulfilled').length;
            console.log('[Quiz-Migrator] Migrados ' + ok + ' quizzes a nueva ruta.');
          });
        }`;

if (quiz.includes(QUIZ_OLD_AUTH_BLOCK)) {
  quiz = quiz.replace(QUIZ_OLD_AUTH_BLOCK, QUIZ_NEW_AUTH_BLOCK);
  console.log('QuizPage: auth block replaced OK');
} else {
  const QUIZ_OLD_CRLF = QUIZ_OLD_AUTH_BLOCK.split('\n').join('\r\n');
  if (quiz.includes(QUIZ_OLD_CRLF)) {
    quiz = quiz.replace(QUIZ_OLD_CRLF, QUIZ_NEW_AUTH_BLOCK);
    console.log('QuizPage: auth block replaced OK (CRLF)');
  } else {
    console.error('QuizPage: Could NOT find old auth block!');
    const lines = quiz.split('\n');
    lines.slice(98, 132).forEach((l, i) => console.log((98+i) + ': ' + l));
  }
}
fs.writeFileSync('src/pages/QuizPage.tsx', quiz, 'utf8');
