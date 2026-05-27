import { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, appId } from '../firebaseConfig';
import { Loader2, MessageCircle, X, Send, Video as VideoIcon, User, Play, Pause, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePermissions } from '../context/PermissionsContext';


interface VideoModule {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  category: string;
  lobId?: string;
  mediaType?: string;
  type?: string;
  mediaUrls?: string[];
}

const VideoItem = ({ 
  video, 
  isActive, 
  onCommentClick, 
  hideActions,
  onToggleExplanation,
  isExplanationOpen
}: { 
  video: VideoModule, 
  isActive: boolean, 
  onCommentClick: (id: string) => void, 
  hideActions: boolean,
  onToggleExplanation: (video: VideoModule) => void,
  isExplanationOpen: boolean
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState<'play' | 'pause' | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);

  // Carousel states
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const isCarousel = video.type === 'carousel' && video.mediaUrls && video.mediaUrls.length > 0;
  const minSwipeDistance = 50;

  useEffect(() => {
    if (isActive && !isExplanationOpen && !isCarousel) {
      videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  }, [isActive, isExplanationOpen, isCarousel]);

  const handleVideoClick = () => {
    if (isCarousel) return;
    if (video.mediaType === 'image' || video.videoUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) return;
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      setFeedback('play');
      setFeedbackKey(prev => prev + 1);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setFeedback('pause');
      setFeedbackKey(prev => prev + 1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentSlide < (video.mediaUrls?.length ?? 1) - 1) {
      setCurrentSlide(prev => prev + 1);
    }
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
     <div 
       data-id={video.id} 
       onClick={handleVideoClick}
       className="video-snap-item snap-start h-screen w-full relative bg-[#0A0A0A] flex items-center justify-center shrink-0 cursor-pointer overflow-hidden"
     >
        {isCarousel ? (
          <div 
            className="w-full h-full relative flex items-center justify-center overflow-hidden bg-black select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Carousel Track */}
            <div 
              className="flex w-full h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {video.mediaUrls!.map((url, i) => (
                <div key={i} className="w-full h-full flex-shrink-0 flex items-center justify-center bg-black">
                  <img 
                    src={url} 
                    alt={`${video.title} - ${i + 1}`} 
                    className="h-full w-full object-contain pointer-events-none"
                  />
                </div>
              ))}
            </div>

            {/* PC Navigation Buttons */}
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide(prev => prev - 1);
                }}
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-[45] p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/60 text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {currentSlide < video.mediaUrls!.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide(prev => prev + 1);
                }}
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-[45] p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/60 text-white transition-colors cursor-pointer"
              >
                <ChevronRight size={20} />
              </button>
            )}

            {/* Indicators Dots */}
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex gap-1.5 z-[45]">
              {video.mediaUrls!.map((_, i) => (
                <div 
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide ? 'bg-blue-500 scale-125' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          video.mediaType === 'image' || video.videoUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
            <img src={video.videoUrl} alt={video.title} className="h-full w-full object-contain select-none" />
          ) : (
            <video 
              ref={videoRef}
              src={video.videoUrl} 
              className="h-full w-full object-cover select-none pointer-events-none"
              controls={false}
              loop
              playsInline
            />
          )
        )}
        
        {/* Play/Pause Animated Feedback */}
        {!isCarousel && feedback && (
          <div key={feedbackKey} className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="p-6 bg-black/60 rounded-full animate-fade-scale text-white border border-white/10">
              {feedback === 'play' ? <Play size={40} fill="white" /> : <Pause size={40} fill="white" />}
            </div>
          </div>
        )}
        
        {/* Overlay Glassmorphism - Degradado inferior para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />
        
        {/* Información del Video */}
        <div className="absolute bottom-28 left-4 right-16 z-10 text-white select-none pointer-events-none">
          <h2 className="text-xl md:text-2xl font-black mb-1 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">{video.title}</h2>
          <p className="text-sm text-gray-300 line-clamp-2 drop-shadow-sm font-medium">{video.description}</p>
          <div className="mt-3 inline-block px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400">
            {video.lobId || 'General'}
          </div>
        </div>
        
        {/* Botón de Explicación (PC & Móvil) */}
        {!hideActions && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleExplanation(video);
            }}
            className="absolute right-4 bottom-48 md:right-8 md:top-1/2 md:bottom-auto md:-translate-y-1/2 z-[45] flex items-center justify-center gap-1.5 px-3 h-9 w-auto max-w-[140px] whitespace-nowrap bg-blue-500/10 backdrop-blur-xl border border-blue-500/25 text-blue-300 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:bg-blue-600/20 active:scale-95 transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider cursor-pointer animate-[bounce_3s_infinite] pointer-events-auto"
          >
            <BookOpen size={12} className="shrink-0" />
            <span>Explicación</span>
          </button>
        )}
        
        {/* Botones de Acción Flotantes - Ocultar si la caja de comentarios está abierta */}
        {!hideActions && (
          <div className="absolute bottom-6 left-6 flex flex-col items-center gap-4 z-[40] pointer-events-auto">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onCommentClick(video.id);
              }}
              className="p-4 bg-white/10 backdrop-blur-2xl rounded-full border border-white/20 text-white hover:bg-white/20 transition-all active:scale-90 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col items-center group"
            >
              <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
     </div>
  );
}

const CommentsDrawer = ({ videoId, onClose }: { videoId: string, onClose: () => void }) => {
  const user = auth.currentUser;
  const { permissions } = usePermissions();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (!videoId) return;
     const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'capacitaciones', videoId, 'comments');
     const q = query(commentsRef, orderBy('createdAt', 'asc'));
     const unsub = onSnapshot(q, (snap) => {
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTimeout(() => endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
     });
     return () => unsub();
  }, [videoId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if(!newComment.trim()) return;
    
    if (editingComment) {
       await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'capacitaciones', videoId, 'comments', editingComment), {
          content: newComment.trim(),
          isEdited: true
       });
       setEditingComment(null);
    } else {
       const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'capacitaciones', videoId, 'comments');
       await addDoc(commentsRef, {
          content: newComment.trim(),
          userId: user?.uid,
          userName: user?.displayName || 'Agente',
          userEmail: user?.email || 'Agente',
          isAdmin: false,
          parentId: replyingTo,
          isEdited: false,
          createdAt: serverTimestamp()
       });
       setReplyingTo(null);
    }
    setNewComment("");
  };

  const startEditing = (comment: any) => {
     setEditingComment(comment.id);
     setReplyingTo(null);
     setNewComment(comment.content);
  };

  const deleteComment = async (id: string) => {
     if (window.confirm("¿Seguro que deseas eliminar este comentario?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'capacitaciones', videoId, 'comments', id));
     }
  };

  const topLevelComments = comments.filter(c => !c.parentId);

  const renderComment = (comment: any) => (
    <div key={comment.id} className={`flex gap-3 mb-4 ${comment.parentId ? 'ml-8 relative' : ''}`}>
      {comment.parentId && <div className="absolute -left-5 top-0 bottom-6 w-px bg-white/20" />}
      {comment.parentId && <div className="absolute -left-5 top-4 w-4 h-px bg-white/20" />}
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
        <User size={16} className="text-gray-300" />
      </div>
      <div className="flex-1">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md">
          <div className="flex items-center justify-between mb-1">
             <div className="flex items-center gap-2">
               <p className="text-xs font-bold text-gray-200">{comment.userEmail.split('@')[0]}</p>
               {comment.isAdmin && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded text-[9px] font-black tracking-widest uppercase">TL / ADMIN</span>}
             </div>
             {comment.createdAt && <p className="text-[10px] text-gray-500">{comment.createdAt.toDate().toLocaleDateString()}</p>}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed break-words">{comment.content}</p>
        </div>
        
        <div className="flex items-center gap-3 mt-1 ml-2">
          {!comment.parentId && (
            <button 
                onClick={(e) => { e.stopPropagation(); setReplyingTo(comment.id); setEditingComment(null); setNewComment(""); }} 
                className="text-[11px] text-gray-400 hover:text-white font-medium transition-colors"
            >
                Responder
            </button>
          )}

          {user?.uid === comment.userId && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); startEditing(comment); }} 
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Editar
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteComment(comment.id); }} 
                className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-x-0 bottom-0 h-3/4 max-h-[600px] bg-[#0A0A0A]/95 backdrop-blur-3xl rounded-t-[3rem] border-t border-white/10 z-50 flex flex-col shadow-[0_-20px_100px_rgba(0,0,0,0.8)] text-white animate-in slide-in-from-bottom-[100%] fade-in duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]">
      <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0">
        <h3 className="font-bold flex items-center gap-2 text-white">
            <MessageCircle size={18} className="text-blue-500"/> Consultas y Feedback
        </h3>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20 no-scrollbar">
        {topLevelComments.map(c => (
           <div key={c.id}>
               {renderComment(c)}
               {comments.filter(reply => reply.parentId === c.id).map(reply => renderComment(reply))}
           </div>
        ))}
        <div ref={endOfMessagesRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-[#0A0A0A] pb-6 relative z-50 shrink-0 mt-auto">
        {(replyingTo || editingComment) && (
           <div className="flex items-center justify-between bg-white/5 border border-white/10 px-4 py-2 rounded-t-xl -mt-4 mb-2 shadow-sm">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                {editingComment ? "Editando Comentario..." : "Respondiendo..."}
              </span>
              <button type="button" onClick={(e) => {e.stopPropagation(); setReplyingTo(null); setEditingComment(null); setNewComment("");}} className="text-gray-500 hover:text-white transition-colors">
                 <X size={14} />
              </button>
           </div>
        )}
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder={editingComment ? "Escribe tu modificación..." : (replyingTo ? "Añade una respuesta..." : "Escribe tu duda al TL...")}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="flex-1 bg-[#111] border border-white/20 shadow-inner rounded-full px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-gray-500"
          />
          <button type="submit" disabled={!newComment.trim()} className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:grayscale shrink-0 shadow-lg">
            <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProcessPage() {
  const user = auth.currentUser;
  const { setHideFloatingNav } = usePermissions();
  const [materiales, setMateriales] = useState<VideoModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLob, setUserLob] = useState<string | null>(null);

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [activeExplanationVideo, setActiveExplanationVideo] = useState<VideoModule | null>(null);

  useEffect(() => {
    setHideFloatingNav(!!activeVideoId || !!activeExplanationVideo);
    return () => setHideFloatingNav(false);
  }, [activeVideoId, activeExplanationVideo, setHideFloatingNav]);

  useEffect(() => {
    const fetchUserLob = async () => {
      if (!user) {
        setUserLob('phone');
        return;
      }
      try {
        const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserLob(userSnap.data().lob || 'phone');
        } else {
          setUserLob('phone');
        }
      } catch (err) {
        setUserLob('phone');
      }
    };
    fetchUserLob();
  }, [user]);

  useEffect(() => {
    const fetchMateriales = async () => {
       if (!userLob) return;
       setLoading(true);
       try {
         const { getDocsWithFallback } = await import("../firebasePaths");
         const querySnapshot = await getDocsWithFallback("processes");
         const videos = querySnapshot.docs
          .map(d => {
             const data = d.data();
             return {
                 id: d.id,
                 title: data.title || "Sin título",
                 description: data.description || "",
                 videoUrl: data.url || "", 
                 category: data.category || "General",
                 lobId: data.lobId || 'phone',
                 mediaType: data.mediaType || (data.type === 'image' ? 'image' : 'video'),
                 type: data.type || 'video',
                 mediaUrls: data.mediaUrls || []
             } as VideoModule;
          })
          .filter(v => (v.videoUrl || (v.mediaUrls && v.mediaUrls.length > 0)) && (v.lobId === userLob || v.lobId === 'phone'));
          
         setMateriales(videos);
         if (videos.length > 0) {
             setVisibleId(videos[0].id);
         }
       } catch (error) {
         console.error("Error fetching materials:", error);
       } finally {
         setLoading(false);
       }
    };
    fetchMateriales();
  }, [userLob]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleId(entry.target.getAttribute('data-id'));
          }
        });
      },
      { threshold: 0.6 }
    );

    document.querySelectorAll('.video-snap-item').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [materiales]);

  if (loading) {
      return (
          <div className="flex justify-center flex-col items-center h-[100dvh] bg-[#0A0A0A] gap-4">
              <Loader2 className="animate-spin text-blue-500" size={48} />
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">Cargando Capacitaciones</p>
          </div>
      );
  }

  if (materiales.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center p-8 bg-[#0A0A0A] h-[100dvh] text-gray-500">
              <VideoIcon className="opacity-20 mb-4 text-gray-600" size={64} />
              <p className="text-lg font-medium text-gray-400">No se encontraron capacitaciones para tu área.</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen h-screen bg-[#050505] flex flex-row items-center justify-center transition-all duration-500 relative overflow-hidden">
      
      {/* Contenedor Principal (The Feed) estilo TikTok */}
      <div className={`h-screen bg-[#0A0A0A] overflow-y-scroll snap-y snap-mandatory relative hide-scrollbar transition-all duration-500 ease-out
        ${activeExplanationVideo ? 'w-full md:w-[50%] lg:w-[48%] md:ml-12 md:mr-6' : 'w-full max-w-md mx-auto'}
      `}>
          {/* CSS inyectado para ocultar barras de scroll y animación de play/pause */}
          <style>{`
            .hide-scrollbar::-webkit-scrollbar { display: none !important; }
            .hide-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            @keyframes fadeScale {
              0% { transform: scale(0.6); opacity: 0; }
              50% { transform: scale(1.1); opacity: 0.9; }
              100% { transform: scale(1.4); opacity: 0; }
            }
            .animate-fade-scale {
              animation: fadeScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          
          {materiales.map((video) => (
             <VideoItem 
                key={video.id} 
                video={video} 
                isActive={visibleId === video.id}
                onCommentClick={(id) => setActiveVideoId(id)}
                hideActions={!!activeVideoId || !!activeExplanationVideo}
                onToggleExplanation={(v) => {
                  if (activeExplanationVideo?.id === v.id) {
                    setActiveExplanationVideo(null);
                  } else {
                    setActiveExplanationVideo(v);
                  }
                }}
                isExplanationOpen={activeExplanationVideo?.id === video.id}
             />
          ))}

      </div>

      {/* Panel Explicativo Deslizable en PC (Material Expressive 3) */}
      {activeExplanationVideo && (
        <div className="hidden md:flex flex-col h-[85vh] w-[45%] lg:w-[48%] mr-12 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 text-white shadow-2xl relative animate-in slide-in-from-right duration-500 ease-out overflow-y-auto">
          {/* Header del Panel */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              Explicación del Módulo
            </span>
            <button 
              onClick={() => setActiveExplanationVideo(null)} 
              className="p-2 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Contenido del Panel */}
          <div className="space-y-6">
            <h3 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent leading-tight drop-shadow-sm uppercase">
              {activeExplanationVideo.title}
            </h3>
            
            <div className="inline-block px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400">
              {activeExplanationVideo.lobId || 'General'}
            </div>

            <p className="text-sm md:text-base text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">
              {activeExplanationVideo.description || "No hay explicación adicional disponible para este módulo."}
            </p>
          </div>
        </div>
      )}

      {/* Panel Móvil (Bottom Sheet) */}
      {activeExplanationVideo && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-[60vh] bg-[#0A0A0A]/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2.5rem] p-6 z-[120] overflow-y-auto shadow-[0_-15px_35px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-500 ease-out">
          {/* Barra Horizontal Superior */}
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
          
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              Explicación
            </span>
            <button 
              onClick={() => setActiveExplanationVideo(null)} 
              className="p-2 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Contenido */}
          <div className="space-y-4">
            <h3 className="text-2xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent leading-tight drop-shadow-sm uppercase">
              {activeExplanationVideo.title}
            </h3>
            
            <div className="inline-block px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400">
              {activeExplanationVideo.lobId || 'General'}
            </div>

            <p className="text-sm text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">
              {activeExplanationVideo.description || "No hay explicación adicional disponible para este módulo."}
            </p>
          </div>
        </div>
      )}

      {activeVideoId && (
        <div className="absolute inset-0 z-[60] pointer-events-none flex flex-col items-center justify-end md:justify-center">
            <div className="pointer-events-auto w-full h-screen md:h-[calc(100vh-80px)] max-w-md mx-auto relative overflow-hidden md:rounded-3xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
               <CommentsDrawer 
                  videoId={activeVideoId} 
                  onClose={() => setActiveVideoId(null)} 
               />
            </div>
        </div>
      )}

    </div>
  );
}
