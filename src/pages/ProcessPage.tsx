import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth, appId } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { Loader2, Library, Video as VideoIcon } from 'lucide-react';
import ProcessCard from '../components/ProcessCard';

interface VideoModule {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  category: string;
  viewedBy: string[];
  thumbnailUrl?: string;
}

export default function ProcessPage() {
  const user = auth.currentUser;
  const [materiales, setMateriales] = useState<VideoModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMateriales = async () => {
       if (!user) return;
       try {
         const { getDocsWithFallback } = await import("../firebasePaths");
         console.log("[ProcessPage] Buscando materiales de capacitación (Doble Fetch)...");
         const querySnapshot = await getDocsWithFallback("processes");
         const videos = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || "Sin título",
                description: data.description || "Sin descripción disponible.",
                videoUrl: data.url || "", 
                category: data.category || "General",
                viewedBy: data.viewedBy || [],
                thumbnailUrl: data.thumbnailUrl 
            } as VideoModule;
         });
         setMateriales(videos);
         console.log(`[ProcessPage] ${videos.length} videos cargados.`);
       } catch (error) {
         console.error("Error fetching materials:", error);
       } finally {
         setLoading(false);
       }
    };
    fetchMateriales();
  }, [user]);

  // Group materials by category
  const groupedMateriales = materiales.reduce((acc, current) => {
    const cat = current.category;
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(current);
    return acc;
  }, {} as Record<string, VideoModule[]>);

  // Sorting categories: General last, others alphabetical
  const sortedCategories = Object.keys(groupedMateriales).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b);
  });

  if (loading) {
      return (
          <div className="flex justify-center items-center h-screen bg-m3-surface dark:bg-m3-surface-dark">
              <Loader2 className="animate-spin text-m3-primary" size={48} />
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-m3-surface-dark p-4 pb-24 transition-colors duration-300">
      <header className="mb-8 mt-4">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-m3-primary/10 rounded-xl">
                <Library className="text-m3-primary" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Capacitaciones</h1>
        </div>
        <p className="text-m3-secondary/70 dark:text-m3-on-surface-dark/60 text-sm">Explora los módulos de aprendizaje continuo por categoría.</p>
      </header>

      {materiales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <VideoIcon className="opacity-10 mb-4" size={64} />
              <p className="text-lg font-medium mb-4">No se encontraron capacitaciones.</p>
              
              <div className="max-w-md w-full p-4 rounded-2xl bg-m3-surface-variant/20 border border-m3-surface-variant/30 text-xs font-mono text-left">
                <p className="text-m3-primary mb-1">Status de Rescate Explicaciones:</p>
                <p>• Nueva Ruta: artifacts/{appId}/public/data/processes ... OK</p>
                <p>• Raíz Antigua: /processes ... OK</p>
                <p className="mt-2 text-[10px] opacity-60">El sistema realiza un fetch paralelo y combina resultados evitando duplicados.</p>
              </div>
          </div>
      ) : (
          <div className="space-y-12">
            {sortedCategories.map(cat => (
              <section key={cat} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark bg-m3-primary/5 dark:bg-white/5 px-4 py-2 rounded-2xl border border-m3-surface-variant/30 dark:border-white/10">
                        {cat}
                    </h2>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-m3-surface-variant/30 dark:from-white/10 to-transparent"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedMateriales[cat].map((module) => (
                    <ProcessCard
                      key={module.id}
                      id={module.id}
                      title={module.title}
                      description={module.description}
                      videoUrl={module.videoUrl}
                      viewedBy={module.viewedBy}
                      userId={auth.currentUser?.uid}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
      )}
    </div>
  );
}
