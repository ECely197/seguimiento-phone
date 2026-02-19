import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Loader2 } from 'lucide-react';
import ProcessCard from '../components/ProcessCard';

interface VideoModule {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
}
// Removed static modules array

export default function ProcessPage() {
  const [materiales, setMateriales] = useState<VideoModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMateriales = async () => {
       try {
         const querySnapshot = await getDocs(collection(db, "processes"));
         const videos = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || "Sin título",
                description: data.description || "Sin descripción disponible.",
                videoUrl: data.url || "", 
                thumbnailUrl: data.thumbnailUrl 
            } as VideoModule;
         });
         setMateriales(videos);
       } catch (error) {
         console.error("Error fetching materials:", error);
       } finally {
         setLoading(false);
       }
    };
    fetchMateriales();
  }, []);

  // Removed modal handlers as video is inline

  if (loading) {
      return (
          <div className="flex justify-center items-center h-screen bg-m3-surface">
              <Loader2 className="animate-spin text-m3-primary" size={48} />
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-m3-surface p-4 pb-24">
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold text-m3-primary">Capacitación</h1>
        <p className="text-m3-secondary text-sm">Módulos de aprendizaje continuo.</p>
      </header>

      {materiales.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
              <p>No hay módulos de capacitación disponibles por el momento.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materiales.map((module) => (
              <ProcessCard
                key={module.id}
                title={module.title}
                description={module.description}
                videoUrl={module.videoUrl}
              />
            ))}
          </div>
      )}
    </div>
  );
}
