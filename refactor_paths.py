import os
import re

FILES = [
    'src/App.tsx',
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
]

# We should be extremely careful about matching collection(db, 'name') and replacing it properly based on the new spec.
# Public data: quizzes, acw_scenarios, content, categories, processes, asignaciones_quizzes (for admin creation?)
# Wait! `asignaciones_quizzes` are they public or user? Probably public since they map a quiz to an agent by email.
# User data: resultados_quizzes, acw_attempts, profiles (which is `users` collection)

def process_file(filepath):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Determine if we need to add imports
    if 'getPublicCollection' not in content and ('collection(db,' in content or 'doc(db,' in content or 'ref(storage,' in content):
        # We need to add the import statement for the helpers.
        import_stmt = "import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, envAppId } from '../firebasePaths';\n"
        if filepath.startswith('src/App.'):
            import_stmt = import_stmt.replace('../', './')
        
        # Inject just below the firebaseConfig import
        content = re.sub(r"(import .* from ['\"](\./|\.\./)firebaseConfig['\"];\n?)", r"\1" + import_stmt, content)

    # Replace collection(db, 'quizzes') -> getPublicCollection('quizzes')
    PUBLIC_COLLECTIONS = ['quizzes', 'acw_scenarios', 'content', 'categories', 'processes', 'asignaciones_quizzes']
    for pc in PUBLIC_COLLECTIONS:
        content = re.sub(r"collection\(\s*db\s*,\s*['\"]" + pc + r"['\"]\s*\)", f"getPublicCollection('{pc}')", content)

    # Note: `users` collection is handled specially as it's the anchor for users/${userId}
    # To list all users: collection(db, 'artifacts', envAppId, 'users')
    content = re.sub(r"collection\(\s*db\s*,\s*['\"]users['\"]\s*\)", r"collection(db, 'artifacts', envAppId, 'users')", content)
    
    # User Profile Doc: doc(db, 'users', user.uid) -> getUserDoc(user.uid)
    content = re.sub(r"doc\(\s*db\s*,\s*['\"]users['\"]\s*,\s*([a-zA-Z0-9_.]+)\s*\)", r"getUserDoc(\1)", content)
    
    # Other public docs: doc(db, 'quizzes', id) -> getPublicDoc('quizzes', id)
    for pc in PUBLIC_COLLECTIONS:
         content = re.sub(r"doc\(\s*db\s*,\s*['\"]" + pc + r"['\"]\s*,\s*([a-zA-Z0-9_\.\-]+)\s*\)", r"getPublicDoc('" + pc + r"', \1)", content)

    # For user collections like resultados_quizzes, acw_attempts.
    # Where they are saved, we use getUserCollection(userId, 'acw_attempts').
    # But wait! In QuizPage/AcwPractice, they are saved under a user.
    # We must use `userId` variable instead of just blindly replacing. 
    # Let's search for how they are currently written.
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for f in FILES:
    process_file(f)
