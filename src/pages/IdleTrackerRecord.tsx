import { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, AlertCircle, Save, CheckCircle2, History, Loader2 } from 'lucide-react';
import { auth } from '../firebaseConfig';
import { getPublicCollection, getUserDoc } from '../firebasePaths';
import { setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export default function IdleTrackerRecord() {
  const [userLOB, setUserLOB] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  // States for the timer
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastEntry, setLastEntry] = useState<any>(null);
  
  const timerRef = useRef<any>(null);

  // 1. Fetch User Profile to check LOB
  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      try {
        const snap = await getDoc(getUserDoc(user.uid));
        if (snap.exists()) {
          setUserLOB(snap.data().lob?.toLowerCase() || 'other');
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  // 2. Load persisted state from localStorage
  useEffect(() => {
    const savedStart = localStorage.getItem('idle_tracker_start');
    const savedIsTracking = localStorage.getItem('idle_tracker_active') === 'true';
    
    if (savedIsTracking && savedStart) {
      const start = parseInt(savedStart, 10);
      setStartTime(start);
      setIsTracking(true);
      setElapsed(Date.now() - start);
    }
  }, []);

  // 3. Timer interval
  useEffect(() => {
    if (isTracking && startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, startTime]);

  const handleStart = () => {
    const now = Date.now();
    setStartTime(now);
    setIsTracking(true);
    setElapsed(0);
    localStorage.setItem('idle_tracker_start', now.toString());
    localStorage.setItem('idle_tracker_active', 'true');
  };

  const handleStop = () => {
    setIsTracking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setShowCommentModal(true);
    localStorage.removeItem('idle_tracker_active');
    localStorage.removeItem('idle_tracker_start');
  };

  const saveRecord = async () => {
    if (!comment.trim()) return;
    setIsSaving(true);
    try {
      const user = auth.currentUser;
      const endTimestamp = Date.now();
      const startTimestamp = startTime || 0;
      const durationMs = endTimestamp - startTimestamp;
      const durationMinutes = Math.round(durationMs / 60000);

      const data = {
        userId: user?.uid || 'anonymous',
        userName: user?.displayName || 'Agente',
        userEmail: user?.email || 'N/A',
        lob: userLOB,
        startTime: new Date(startTimestamp).toISOString(),
        endTime: new Date(endTimestamp).toISOString(),
        durationMinutes,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
        date: new Date(endTimestamp).toLocaleDateString('en-CA'), // YYYY-MM-DD
      };

      console.log("[IdleTracker] Guardando registro en artifacts/idle_tracker...", data);
      await addDoc(getPublicCollection('idle_tracker'), data);
      
      setLastEntry(data);
      setShowCommentModal(false);
      setComment('');
      setElapsed(0);
      setStartTime(null);
    } catch (err) {
      console.error("Error saving idle record:", err);
      alert("Error al guardar el registro. Intentalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 60000) % 60);
    const hours = Math.floor(ms / 3600000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-m3-primary" size={40} />
        <p className="text-sm text-gray-500">Verificando acceso...</p>
      </div>
    );
  }

  // Permission Check: only 'recupero'
  if (userLOB !== 'recupero') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] bg-[#050505] p-12 text-center gap-4">
        <div className="p-4 bg-red-900/30 rounded-full text-red-500 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <AlertCircle size={48} />
        </div>
        <h2 className="text-2xl font-bold text-white">Acceso Restringido</h2>
        <p className="text-gray-400 max-w-sm">Este módulo es de uso exclusivo para el equipo de Recupero.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] min-h-screen md:h-[calc(100vh-100px)] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 relative pb-32 md:pb-6">
      
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-900/40 border border-purple-500/50 text-purple-300 rounded-full text-[10px] font-black uppercase tracking-widest drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] mb-4">
          <Clock size={14} /> Equipo Recupero
        </div>
        <h1 className="text-3xl font-black text-white drop-shadow-md">Idle Time Tracker</h1>
        <p className="text-sm text-gray-400 font-medium">Mide tu tiempo de espera sin casos asignados.</p>
      </div>

      {/* Timer Card */}
      <div className="bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2rem] p-10 flex flex-col items-center max-w-md w-full text-white relative overflow-hidden">
        
        {/* Decorative background element */}
        <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 rounded-full -mr-10 -mt-10 transition-colors pointer-events-none ${isTracking ? 'bg-red-500' : 'bg-blue-600'}`} />

        <div className={`font-mono text-6xl md:text-7xl font-black drop-shadow-[0_0_15px_currentColor] tracking-tight mb-8 transition-colors duration-500 ${isTracking ? 'text-blue-400' : 'text-gray-500'}`}>
          {formatElapsedTime(elapsed)}
        </div>

        <div className="flex w-full justify-center">
          {!isTracking ? (
            <button 
              onClick={handleStart}
              className="w-full bg-blue-600 text-white rounded-2xl py-4 px-8 text-xl font-bold hover:bg-blue-500 transition-colors shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(59,130,246,0.5)] flex items-center justify-center gap-3 active:scale-95"
            >
              <Play size={24} fill="currentColor" /> INICIAR TIEMPO
            </button>
          ) : (
            <button 
              onClick={handleStop}
              className="w-full bg-red-500/20 text-red-500 border border-red-500/50 rounded-2xl py-4 px-8 text-xl font-bold hover:bg-red-500 hover:text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse flex items-center justify-center gap-3 active:scale-95"
            >
              <Square size={24} fill="currentColor" /> DETENER CRONO
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center mt-6 font-medium max-w-xs mx-auto">
          {isTracking 
            ? "El cronómetro está activo. Se guardará localmente si cierras la ventana."
            : "Presiona el botón para empezar a medir tu tiempo en espera."}
        </p>
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#0A0A0A]/95 backdrop-blur-3xl w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-white/10 text-white">
            <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
              <Save className="text-blue-500" /> Finalizar Registro
            </h3>
            <p className="text-sm text-gray-400 mb-6 font-medium">
              Tiempo total: <span className="font-black text-blue-400 text-lg ml-1">{formatElapsedTime(elapsed)}</span>
            </p>
            
            <textarea 
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Escribe el motivo del tiempo muerto (ej: Sin casos para llamar)..."
              className="w-full p-4 rounded-2xl bg-[#111] border border-white/10 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white mb-8 resize-none shadow-inner placeholder:text-gray-600 transition-all"
            />

            <div className="flex gap-3">
              <button 
                onClick={() => setShowCommentModal(false)}
                className="flex-1 py-3.5 bg-white/10 text-gray-300 hover:bg-white/20 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={saveRecord}
                disabled={!comment.trim() || isSaving}
                className="flex-1 py-3.5 bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:bg-green-400 disabled:opacity-50 transition-colors"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Entry History */}
      {lastEntry && (
        <div className="absolute bottom-32 md:bottom-12 bg-green-900/30 border border-green-500/50 rounded-2xl p-4 flex items-center gap-4 shadow-lg animate-in slide-in-from-bottom-4 backdrop-blur-md">
          <div className="p-2 bg-green-500/20 rounded-full text-green-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-black text-green-400">¡Registro guardado exitosamente!</p>
            <p className="text-xs text-green-300 font-medium opacity-80">Duración: {lastEntry.durationMinutes} min</p>
          </div>
        </div>
      )}

    </div>
  );
}
