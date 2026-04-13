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
      <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full text-red-500">
          <AlertCircle size={48} />
        </div>
        <h2 className="text-2xl font-bold dark:text-white">Acceso Restringido</h2>
        <p className="text-gray-500 max-w-sm">Este módulo es de uso exclusivo para el equipo de Recupero.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-[#121212] p-4 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto space-y-8 mt-4">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-bold uppercase tracking-widest">
            <Clock size={14} /> Equipo Recupero
          </div>
          <h1 className="text-3xl font-extrabold text-m3-secondary dark:text-white">Idle Time Tracker</h1>
          <p className="text-sm text-gray-500 italic">Mide tu tiempo de espera sin casos asignados.</p>
        </div>

        {/* Timer Card */}
        <div className="bg-white dark:bg-[#1E1E1E] rounded-[32px] p-8 shadow-large border border-m3-surface-variant/30 dark:border-white/10 flex flex-col items-center gap-8 relative overflow-hidden">
          
          {/* Decorative background element */}
          <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 rounded-full -mr-10 -mt-10 transition-colors ${isTracking ? 'bg-orange-500' : 'bg-m3-primary'}`} />

          <div className="text-7xl font-mono font-bold text-m3-primary dark:text-m3-primary-dark tracking-tighter">
            {formatElapsedTime(elapsed)}
          </div>

          <div className="flex gap-4 w-full justify-center">
            {!isTracking ? (
              <button 
                onClick={handleStart}
                className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-[24px] font-bold text-xl shadow-xl hover:shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-100"
              >
                <div className="absolute inset-0 bg-white/20 rounded-[24px] opacity-0 group-hover:opacity-100 animate-pulse" />
                <Play size={28} fill="currentColor" /> INICIAR TIEMPO
              </button>
            ) : (
              <button 
                onClick={handleStop}
                className="flex items-center justify-center gap-3 px-10 py-5 bg-red-500 hover:bg-red-600 text-white rounded-[24px] font-bold text-xl shadow-xl hover:shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-100 animate-pulse"
              >
                <Square size={28} fill="currentColor" /> DETENER CRONO
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center max-w-xs">
            {isTracking 
              ? "El cronómetro está activo. Se guardará localmente si cierras la ventana."
              : "Presiona el botón para empezar a medir tu tiempo en espera."}
          </p>
        </div>

        {/* Comment Modal */}
        {showCommentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-[32px] p-6 shadow-2xl border border-m3-surface-variant/20">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Finalizar Registro</h3>
              <p className="text-sm text-gray-500 mb-4">
                Tiempo total: <span className="font-bold text-m3-primary">{formatElapsedTime(elapsed)}</span>
              </p>
              
              <textarea 
                rows={4}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Escribe el motivo del tiempo muerto (ej: Sin casos para llamar)..."
                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-orange-500 text-sm dark:text-white mb-6 resize-none"
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCommentModal(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveRecord}
                  disabled={!comment.trim() || isSaving}
                  className="flex-1 py-3 bg-m3-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
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
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800 dark:text-green-300">¡Registro guardado exitosamente!</p>
              <p className="text-xs text-green-700/70 dark:text-green-400/50">Duración: {lastEntry.durationMinutes} min</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
