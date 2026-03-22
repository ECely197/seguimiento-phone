const fs = require('fs');

let paths = fs.readFileSync('src/firebasePaths.ts', 'utf8');

paths = paths.replace(/export const getDocsWithFallback =[\s\S]*/, '');

const replacement = `
export const getDocsWithFallback = async (collectionName: string, ...queryConstraints: any[]) => {
  const { getDocs, query, collection, setDoc, doc } = await import('firebase/firestore');
  const path1 = getPublicCollection(collectionName);
  console.log(\`[Firebase] Buscando inicialmente en: artifacts/\${appId}/public/data/\${collectionName}\`);
  
  let snap;
  
  const migrateData = async (oldSnap: any) => {
    if (!oldSnap || oldSnap.empty) return;
    console.log(\`[Firebase-Migrator] Detectados \${oldSnap.size} documentos en la raíz /\${collectionName}. Copiando a nueva ruta...\`);
    const promises = oldSnap.docs.map((d: any) => {
       const newDocRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, d.id);
       return setDoc(newDocRef, d.data(), { merge: true });
    });
    try {
       await Promise.all(promises);
       console.log(\`[Firebase-Migrator] ¡Éxito! \${oldSnap.size} docs migrados a artifacts/\${appId}/public/data/\${collectionName}.\`);
    } catch(err) {
       console.error(\`[Firebase-Migrator] Error migrando \${collectionName}:\`, err);
    }
  };

  try {
      if (queryConstraints.length > 0) {
          snap = await getDocs(query(path1, ...queryConstraints));
      } else {
          snap = await getDocs(path1);
      }
      
      if (!snap || snap.empty) {
         console.warn(\`[Firebase] La colección nueva está vacía o falló. Rescatando datos desde la ruta antigua raíz: /\${collectionName}\`);
         const oldPath = collection(db, collectionName);
         if (queryConstraints.length > 0) {
             snap = await getDocs(query(oldPath, ...queryConstraints));
         } else {
             snap = await getDocs(oldPath);
         }
         console.log(\`[Firebase] Se encontraron \${snap ? snap.size : 0} rescates en /\${collectionName}\`);
         if (snap && !snap.empty) {
            // Trigger auto-migration asynchronously
            migrateData(snap);
         }
      } else {
         console.log(\`[Firebase] Se encontraron \${snap.size} documentos en public/data/\${collectionName}\`);
      }
  } catch(e) {
      console.error(\`[Firebase] Error estricto en \${collectionName}, yendo al respaldo:\`, e);
      const oldPath = collection(db, collectionName);
      if (queryConstraints.length > 0) {
          snap = await getDocs(query(oldPath, ...queryConstraints));
      } else {
          snap = await getDocs(oldPath);
      }
      console.log(\`[Firebase] Se encontraron \${snap ? snap.size : 0} rescates preventivos en /\${collectionName}\`);
      if (snap && !snap.empty) {
         migrateData(snap);
      }
  }
  
  return snap;
};
`;

paths = paths + '\n' + replacement;
fs.writeFileSync('src/firebasePaths.ts', paths, 'utf8');

console.log('Done mapping migration!');
