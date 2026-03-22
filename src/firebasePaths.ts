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

  // Búsqueda en ruta nueva (por cada usuario)
  try {
    const usersRef = collection(db, 'artifacts', appId, 'users');
    const usersSnap = await getDocs(usersRef);
    for (const userDoc of usersSnap.docs) {
      const subSnap = await getDocs(getUserCollection(userDoc.id, collectionName));
      subSnap.forEach(d => {
        allDataMap.set(d.id, { id: d.id, path: d.ref.path, ...d.data() });
      });
    }
  } catch (err) {
    console.error('[Firebase] Error leyendo subcolecciones en new path:', err);
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
     console.warn(`[Firebase] No se pudo rescatar legacy en ${collectionName} (quizás no existía).`, err);
  }

  return Array.from(allDataMap.values());
};

export const getDocsWithFallback = async (collectionName: string, ...queryConstraints: any[]) => {
  const { getDocs, query, collection, setDoc, doc } = await import('firebase/firestore');
  const path1 = getPublicCollection(collectionName);
  const oldPath = collection(db, collectionName);
  
  console.log(`[Firebase] Ejecutando Doble Fetch para: ${collectionName}`);
  
  const qNew = queryConstraints.length > 0 ? query(path1, ...queryConstraints) : path1;
  const qOld = queryConstraints.length > 0 ? query(oldPath, ...queryConstraints) : oldPath;

  const [snapNewRes, snapOldRes] = await Promise.allSettled([
      getDocs(qNew),
      getDocs(qOld)
  ]);

  const mapData = new Map();
  const docsToReturn: any[] = [];
  const docsToMigrate: any[] = [];

  // Data from NEW path has priority
  if (snapNewRes.status === 'fulfilled' && snapNewRes.value && !snapNewRes.value.empty) {
      snapNewRes.value.docs.forEach(d => {
          mapData.set(d.id, true);
          docsToReturn.push(d); // we keep standard DocumentSnapshots to emulate getDocs return format!
      });
      console.log(`[Firebase] ${snapNewRes.value.size} items detectados en artifacts/${appId}`);
  }

  // Rescate from OLD path
  if (snapOldRes.status === 'fulfilled' && snapOldRes.value && !snapOldRes.value.empty) {
      snapOldRes.value.docs.forEach(d => {
          if (!mapData.has(d.id)) {
              mapData.set(d.id, true);
              docsToReturn.push(d);
              docsToMigrate.push(d);
          }
      });
      console.log(`[Firebase] ${docsToMigrate.length} items rescatados desde raíz /${collectionName}`);
  }

  // Funciones de emulación para mantener la compatibilidad con el resto del app
  const fauxSnap = {
     empty: docsToReturn.length === 0,
     size: docsToReturn.length,
     docs: docsToReturn
  };

  // Auto-Miguel: Guarda la copia para hacerlo permanente
  if (docsToMigrate.length > 0) {
      console.log(`[Firebase-Migrator] Guardando copia permanente de ${docsToMigrate.length} docs en artifacts/${appId}/public/data/${collectionName}...`);
      const promises = docsToMigrate.map(d => {
          const newDocRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, d.id);
          return setDoc(newDocRef, d.data(), { merge: true });
      });
      Promise.allSettled(promises).then((results) => {
          const ok = results.filter(r => r.status === 'fulfilled').length;
          console.log(`[Firebase-Migrator] ¡Éxito! ${ok} docs migrados a ${collectionName}`);
      });
  }

  return fauxSnap;
};
