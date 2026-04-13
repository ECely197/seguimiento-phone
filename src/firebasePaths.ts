import { collection, doc, collectionGroup } from 'firebase/firestore';
import { ref } from 'firebase/storage';
import { db, storage, appId } from './firebaseConfig';

export const getPublicCollection = (collectionName: string) => 
  collection(db, 'artifacts', appId, 'public', 'data', collectionName);

export const getUserCollection = (userId: string, collectionName: string) => 
  collection(db, 'artifacts', appId, 'users', userId, collectionName);

export const getPublicDoc = (collectionName: string, docId: string) => 
  doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId);

export const getUserDoc = (userId: string) => 
  doc(db, 'artifacts', appId, 'users', userId);

export const getAppStorageRef = (path: string) => 
  ref(storage, `artifacts/${appId}/${path}`);


export const fetchAllUsersSubcollection = async (collectionName: string) => {
  const { getDocs, collection, query } = await import('firebase/firestore');
  
  const allDataMap = new Map();

  console.log(`[Firebase] fetchAllUsersSubcollection: Iniciando doble escaneo para ${collectionName}...`);

  // Búsqueda en ruta nueva (por cada usuario)
  try {
    const usersRef = collection(db, 'artifacts', appId, 'users');
    const usersSnap = await getDocs(usersRef);
    for (const userDoc of usersSnap.docs) {
      const subSnap = await getDocs(getUserCollection(userDoc.id, collectionName));
      subSnap.forEach(d => {
        allDataMap.set(d.id, { id: d.id, userId: userDoc.id, path: d.ref.path, ...d.data() });
      });
    }
  } catch (err) {
    console.warn('[Firebase] Warning leyendo subcolecciones en new path:', err);
  }

  // Búsqueda en ruta antigua raíz (ej. /acw_attempts_o_resultados_quizzes si existieran ahí)
  try {
     const oldPath = collection(db, collectionName);
     const oldSnap = await getDocs(oldPath);
     oldSnap.forEach(d => {
        if (!allDataMap.has(d.id)) {
           allDataMap.set(d.id, { id: d.id, path: d.ref.path, ...d.data(), _isLegacy: true });
        }
     });
     console.log(`[Firebase] fetchAllUsersSubcollection ${collectionName}: consolidados ${allDataMap.size} registros.`);
  } catch(err) {
     console.warn(`[Firebase] No se pudo rescatar legacy en ${collectionName} (quizás no existía).`);
  }

  return Array.from(allDataMap.values());
};

export const getDocsWithFallback = async (collectionName: string, ...queryConstraints: any[]) => {
  const { getDocs, query, collection, setDoc, doc } = await import('firebase/firestore');
  const pathNew = getPublicCollection(collectionName);
  const pathOld = collection(db, collectionName);
  
  console.log(`[Firebase] Doble Fetch: Buscando ${collectionName} en artifacts/${appId} y raíz /${collectionName}...`);
  
  const [resNew, resOld] = await Promise.allSettled([
      getDocs(queryConstraints.length > 0 ? query(pathNew, ...queryConstraints) : pathNew),
      getDocs(queryConstraints.length > 0 ? query(pathOld, ...queryConstraints) : pathOld)
  ]);

  const mapData = new Map();
  const docsToMigrate: any[] = [];

  // Prioridad: Datos en la ruta nueva de Artifacts
  if (resNew.status === 'fulfilled' && !resNew.value.empty) {
      resNew.value.docs.forEach(d => {
          mapData.set(d.id, d);
      });
      console.log(`[Firebase] ${resNew.value.size} items encontrados en la ruta de artifacts.`);
  } else if (resNew.status === 'rejected') {
      console.warn(`[Firebase] Error consultando ruta nueva de ${collectionName}:`, resNew.reason);
  }

  // Rescate: Datos en la raíz antigua (si no existen ya en la nueva)
  if (resOld.status === 'fulfilled' && !resOld.value.empty) {
      let rescueCount = 0;
      resOld.value.docs.forEach(d => {
          if (!mapData.has(d.id)) {
              mapData.set(d.id, d);
              docsToMigrate.push(d);
              rescueCount++;
          }
      });
      if (rescueCount > 0) {
          console.log(`[Firebase] ${rescueCount} items rescatados desde la raíz /${collectionName}.`);
      }
  }

  const finalDocs = Array.from(mapData.values());

  // Emulación de snapshot para compatibilidad
  const fauxSnap = {
     empty: finalDocs.length === 0,
     size: finalDocs.length,
     docs: finalDocs
  };

  // Auto-Miguel: Guarda la copia para hacerlo permanente
  if (docsToMigrate.length > 0) {
      console.log(`[Firebase-Migrator] Detectada información en raíz. Migrando ${docsToMigrate.length} docs a artifacts/${appId}/public/data/${collectionName}...`);
      const promises = docsToMigrate.map(d => {
          const newDocRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, d.id);
          return setDoc(newDocRef, d.data(), { merge: true });
      });
      
      Promise.allSettled(promises).then((results) => {
          const ok = results.filter(r => r.status === 'fulfilled').length;
          console.log(`[Firebase-Migrator] ¡Éxito! ${ok}/${docsToMigrate.length} documentos migrados permanentemente.`);
      });
  }

  return fauxSnap;
};
