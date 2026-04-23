import { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, appId } from '../firebaseConfig';
import { Loader2, MessageCircle, X, Send, Video as VideoIcon, User } from 'lucide-react';
import { usePermissions } from '../context/PermissionsContext';

interface VideoModule {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  category: string;
  lobId?: string;
  mediaType?: string;
}

const VideoItem = ({ video, isActive, onCommentClick, hideActions }: { video: VideoModule, isActive: boolean, onCommentClick: (id: string) => void, hideActions: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().catch(() => {});
    } else {
      videoRef.current?.pause();
    }
  }, [isActive]);

  return (
     <div data-id={video.id} className="video-snap-item snap-start h-screen w-full relative bg-[#0A0A0A] flex items-center justify-center shrink-0">
        {video.mediaType === 'image' || video.videoUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
          <img src={video.videoUrl} alt={video.title} className="h-full w-full object-contain" />
        ) : (
          <video 
            ref={videoRef}
            src={video.videoUrl} 
            className="h-full w-full object-cover"
            controls={false}
            loop
            playsInline
          />
        )}
        
        {/* Overlay Glassmorphism - Degradado inferior para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />
        
        {/* Información del Video */}
        <div className="absolute bottom-28 left-4 right-16 z-10 text-white">
          <h2 className="text-xl md:text-2xl font-black mb-1 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">{video.title}</h2>
          <p className="text-sm text-gray-300 line-clamp-2 drop-shadow-sm font-medium">{video.description}</p>
          <div className="mt-3 inline-block px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400">
            {video.lobId || 'General'}
          </div>
        </div>
        
        {/* Botones de Acción Flotantes - Ocultar si la caja de comentarios está abierta */}
        {!hideActions && (
          <div className="absolute bottom-6 left-6 flex flex-col items-center gap-4 z-[50] pointer-events-auto">
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

  useEffect(() => {
    setHideFloatingNav(!!activeVideoId);
    return () => setHideFloatingNav(false);
  }, [activeVideoId, setHideFloatingNav]);

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
                 mediaType: data.mediaType || (data.type === 'image' ? 'image' : 'video')
             } as VideoModule;
          })
          .filter(v => v.videoUrl && (v.lobId === userLob || v.lobId === 'phone'));
          
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
    <div className="min-h-screen h-screen bg-[#050505] flex flex-col items-center justify-center transition-colors duration-300 relative overflow-hidden">
      
      {/* Contenedor Principal (The Feed) estilo TikTok */}
      <div className="h-screen w-full max-w-md mx-auto bg-[#0A0A0A] overflow-y-scroll snap-y snap-mandatory relative hide-scrollbar">
          
          {materiales.map((video) => (
             <VideoItem 
                key={video.id} 
                video={video} 
                isActive={visibleId === video.id}
                onCommentClick={(id) => setActiveVideoId(id)}
                hideActions={!!activeVideoId}
             />
          ))}

      </div>

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
