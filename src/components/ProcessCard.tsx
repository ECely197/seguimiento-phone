import { Eye } from 'lucide-react'; 
import { db } from '../firebaseConfig';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';


interface ProcessCardProps {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  viewedBy?: string[];
  userId?: string;
}

export default function ProcessCard({ id, title, description, videoUrl, viewedBy = [], userId }: ProcessCardProps) {
  const hasViewed = userId ? viewedBy.includes(userId) : false;

  const markAsViewed = async () => {
    if (!userId || hasViewed) return;
    
    try {
      const docRef = doc(db, 'processes', id);
      await updateDoc(docRef, {
        viewedBy: arrayUnion(userId)
      });
    } catch (error) {
      console.error("Error marking as viewed:", error);
    }
  };
  return (
    <div className="bg-white rounded-[28px] shadow-sm border border-m3-surface-variant/50 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      {/* Video Player */}
      <div className="relative w-full aspect-video rounded-t-xl overflow-hidden bg-black group/video">
        <video 
          src={videoUrl} 
          controls 
          onPlay={markAsViewed}
          className="absolute inset-0 w-full h-full object-contain" 
        />
        {hasViewed && (
          <div className="absolute top-3 right-3 bg-green-500/90 text-white px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-lg backdrop-blur-sm z-10">
            <Eye size={14} strokeWidth={3} />
            VISTO
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-m3-secondary mb-2 line-clamp-2" title={title}>{title}</h3>
        <p className="text-m3-secondary/80 text-sm flex-grow">{description}</p>
      </div>
    </div>
  );
}
