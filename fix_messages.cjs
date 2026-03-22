const fs = require('fs');

let proc = fs.readFileSync('src/pages/ProcessPage.tsx', 'utf8');
proc = proc.replace(
  '<p>No hay módulos de capacitación disponibles por el momento.</p>',
  '<p>Buscando en /artifacts/${appId}/public/data/processes...</p><p className="text-xs mt-2 text-red-500 font-mono">(Fallback Mode: Evaluando también en /processes raíz automáticamente si no hay datos nuevos)</p>'
);
// Import appId to fix the Template string variable if it's evaluated
if (!proc.includes('appId')) {
  proc = proc.replace("import { db, auth }", "import { db, auth, appId }");
}
fs.writeFileSync('src/pages/ProcessPage.tsx', proc, 'utf8');

let quiz = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');
quiz = quiz.replace(
  '<p className="text-lg text-m3-secondary dark:text-m3-on-surface-dark">No hay pruebas disponibles este día.</p>',
  '<p className="text-lg text-m3-secondary dark:text-m3-on-surface-dark">Buscando en /artifacts/{appId}/public/data/quizzes...</p><p className="text-xs mt-2 text-red-500 font-mono">(Fallback Mode: Buscando en /quizzes raíz si la nueva ruta retornó vacío)</p>'
);
if (!quiz.includes('appId')) {
  quiz = quiz.replace("import { db }", "import { db, appId }");
}
fs.writeFileSync('src/pages/QuizPage.tsx', quiz, 'utf8');
