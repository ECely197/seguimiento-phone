const fs = require('fs');
const path = require('path');

const FILES = [
    'src/pages/AcwPractice.tsx',
    'src/pages/QuizPage.tsx',
    'src/pages/ProcessPage.tsx',
    'src/pages/AdminDashboard.tsx',
    'src/pages/AdminAcwManager.tsx',
    'src/pages/AdminAcwStats.tsx',
    'src/pages/AdminAgents.tsx',
    'src/pages/AdminProcessUpload.tsx',
    'src/pages/AdminQuizAssigner.tsx',
    'src/pages/AdminQuizEditor.tsx',
    'src/pages/AdminQuizManager.tsx',
    'src/pages/AdminResults.tsx',
    'src/pages/AdminUsers.tsx',
    'src/pages/ExecutiveReportPage.tsx'
];

function processFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');

    // Add imports if needed
    if (!content.includes('getPublicCollection') && (content.includes('collection(db') || content.includes('doc(db') || content.includes('ref(storage'))) {
        const importStmt = "import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, getAdminCollectionGroup } from '../firebasePaths';\n";
        content = content.replace(/(import .* from ['"](?:\.\/|\.\.\/)firebaseConfig['"];\n?)/, "$1" + importStmt);
    }

    const PUBLIC_COLS = ['quizzes', 'acw_scenarios', 'content', 'categories', 'processes', 'asignaciones_quizzes'];
    
    // collection(db, 'public_collection') -> getPublicCollection('public_collection')
    for (const pc of PUBLIC_COLS) {
        let regex = new RegExp(`collection\\(\\s*db\\s*,\\s*['"]${pc}['"]\\s*\\)`, 'g');
        content = content.replace(regex, `getPublicCollection('${pc}')`);
    }

    for (const pc of PUBLIC_COLS) {
        let regexDoc = new RegExp(`doc\\(\\s*db\\s*,\\s*['"]${pc}['"]\\s*,\\s*([a-zA-Z0-9_\\.\\-]+)\\s*\\)`, 'g');
        content = content.replace(regexDoc, `getPublicDoc('${pc}', $1)`);
    }

    // Replace users collection
    content = content.replace(/collection\(\s*db\s*,\s*['"]users['"]\s*\)/g, "collection(db, 'artifacts', envAppId, 'users')");
    // Also we need to import envAppId for this raw replacement:
    if (content.includes("collection(db, 'artifacts', envAppId, 'users')") && !content.includes('envAppId')) {
        content = content.replace(/(import .* from ['"](?:\.\/|\.\.\/)firebaseConfig['"];\n?)/, "$1import { envAppId } from '../firebasePaths';\n");
    }

    // User docs
    content = content.replace(/doc\(\s*db\s*,\s*['"]users['"]\s*,\s*([a-zA-Z0-9_\.]+)\s*\)/g, "getUserDoc($1)");

    // Acw attempts and resultados_quizzes (for admins) -> getAdminCollectionGroup
    if (filepath.includes('Admin') || filepath.includes('Executive')) {
        content = content.replace(/collection\(\s*db\s*,\s*['"]acw_attempts['"]\s*\)/g, "getAdminCollectionGroup('acw_attempts')");
        content = content.replace(/collection\(\s*db\s*,\s*['"]resultados_quizzes['"]\s*\)/g, "getAdminCollectionGroup('resultados_quizzes')");
    }

    fs.writeFileSync(filepath, content, 'utf8');
}

FILES.forEach(processFile);
console.log("Done");
