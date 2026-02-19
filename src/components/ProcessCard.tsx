import { Play } from 'lucide-react';

interface ProcessCardProps {
  title: string;
  description: string;
  videoUrl: string;
}

export default function ProcessCard({ title, description, videoUrl }: ProcessCardProps) {
  return (
    <div className="bg-white rounded-[28px] shadow-sm border border-m3-surface-variant/50 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      {/* Video Player */}
      <div className="relative w-full aspect-video rounded-t-xl overflow-hidden bg-black">
        <video 
          src={videoUrl} 
          controls 
          className="absolute inset-0 w-full h-full object-contain" 
        />
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-m3-secondary mb-2 line-clamp-2" title={title}>{title}</h3>
        <p className="text-m3-secondary/80 text-sm flex-grow">{description}</p>
      </div>
    </div>
  );
}
