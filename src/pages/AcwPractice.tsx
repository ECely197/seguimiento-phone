import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, setDoc, getDocs, orderBy, query, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth, appId } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  Timer, Play, ChevronRight, ChevronLeft, CheckCircle2, Zap, Clock,
  Search, Loader2, Trophy, Copy, Check, Shuffle, PhoneOff
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcwScenario {
  id: string;
  title: string;
  videoUrl: string;
  lobId?: string;
  contextOrderNumber?: string;
  contextTicketId?: string;
}

// Phase flow:
//  lobby          → user sees the big random challenge button
//  listening      → video plays, timer is 00:00 and PAUSED, "Colgar" button visible
//  acw            → user clicked "Colgar", timer RUNNING, all fields enabled
//  result         → "Cerrar Ticket" clicked, timer stopped, result shown
type PracticeState = 'lobby' | 'listening' | 'acw' | 'result';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (ms: number) => {
  const secs = Math.floor(ms / 1000);
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
};

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} title="Copiar"
      className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ── Contact Reasons (Reduced list for brevity in code, but keeping the logic) ──
const CONTACT_REASONS = [
  "Queja sobre la gestión del Account management",
  "Solicitud de reunión con el comercial",
  "Consulta sobre el servicio de pick-up",
  "Consulta del servicio de logística",
  "Demanda de motorizados",
  "Local aparece cerrado",
  "No puede iniciar sesión",
  "Problema técnico",
  "Solicitud de insumos",
  "Otros problemas con la app",
  "Consulta sobre caso anterior",
  "Usuario no aceptó el pedido",
  "Pedido duplicado",
  "Repartidor no llegó",
  "Cambio de dirección",
  "Partner no recibió el pago"
];



// ── Main Component ────────────────────────────────────────────────────────────
export default function AcwPractice() {
  const [allScenarios, setAllScenarios] = useState<AcwScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<AcwScenario | null>(null);
  const [lastScenarioId, setLastScenarioId] = useState<string | null>(null);
  const [userLob, setUserLob] = useState<string | null>(null);

  const [state, setState] = useState<PracticeState>('lobby');
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Form
  const [nota, setNota] = useState('');
  const [reasonSearch, setReasonSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [comment, setComment] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [formError, setFormError] = useState('');

  // Result
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);

  useEffect(() => {
    const fetchUserLob = async () => {
      const user = auth.currentUser;
      if (!user) {
        setUserLob('phone');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid));
        setUserLob(snap.exists() ? (snap.data().lob || 'phone') : 'phone');
      } catch (err) {
        console.error(err);
        setUserLob('phone');
      }
    };
    fetchUserLob();
  }, []);

  useEffect(() => {
    const fetch = async () => {
      if (!userLob) return;
      setLoading(true);
      try {
        const { getDocsWithFallback } = await import("../firebasePaths");
        console.log(`[AcwPractice] Buscando escenarios para LOB: ${userLob}`);
        const snap = await getDocsWithFallback('acw_scenarios', orderBy('createdAt', 'asc'));
        
        const filtered = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as AcwScenario))
          .filter(s => s.lobId === userLob || s.lobId === 'phone');

        setAllScenarios(filtered);
        console.log(`[AcwPractice] ${filtered.length} escenarios filtrados listos.`);
      } catch (err) {
        console.error("Error fetching ACW scenarios:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userLob]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Timer (only runs in 'acw' phase) ─────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - (startTimeRef.current ?? Date.now()));
    }, 50);
  }, []);

  const stopTimer = useCallback((): number => {
    if (timerRef.current) clearInterval(timerRef.current);
    return Date.now() - (startTimeRef.current ?? Date.now());
  }, []);

  // ── Pick random (avoid immediate repeat) ─────────────────────────────────
  const pickRandom = useCallback((): AcwScenario | null => {
    if (allScenarios.length === 0) return null;
    if (allScenarios.length === 1) return allScenarios[0];
    const pool = allScenarios.filter(s => s.id !== lastScenarioId);
    return pool[Math.floor(Math.random() * pool.length)];
  }, [allScenarios, lastScenarioId]);

  // ── Phase 1: Iniciar → 'listening' ───────────────────────────────────────
  const handleStartChallenge = () => {
    const picked = pickRandom();
    if (!picked) return;

    setNota('');
    setReasonSearch('');
    setSelectedReason('');
    setComment('');
    setSelectedAction('');
    setFormError('');
    setElapsed(0);
    setScenario(picked);
    setLastScenarioId(picked.id);
    setState('listening');
    // Play video automatically (timer is still zero)
    setTimeout(() => videoRef.current?.play(), 100);
  };

  // ── Phase 2: Colgar → 'acw' ───────────────────────────────────────────────
  const handleHangUp = () => {
    videoRef.current?.pause();
    setState('acw');
    startTimer(); // TIMER STARTS HERE
  };

  // ── Phase 3: Cerrar Ticket → 'result' ────────────────────────────────────
  const handleClose = async () => {
    if (!selectedReason) { setFormError('Selecciona un motivo de contacto PCR3.'); return; }
    if (!comment.trim()) { setFormError('El Comentario en HC es obligatorio.'); return; }
    if (!selectedAction) { setFormError('Selecciona una opción de finalización.'); return; }
    setFormError('');

    const finalMs = stopTimer();
    setFinalTimeMs(finalMs);
    setState('result');

    setIsSavingAttempt(true);
    try {
      const user = auth.currentUser;
      const isGuest = !user;

      const uidToUse = user?.uid ?? ('guest_' + crypto.randomUUID().slice(0, 8));
      await setDoc(getUserDoc(uidToUse), { 
        isGuest: isGuest, 
        email: user?.email ?? 'invitado@visitante.com', 
        name: isGuest ? 'Invitado' : (user?.displayName || ''),
        lastActivity: serverTimestamp() 
      }, { merge: true });
      await addDoc(getUserCollection(uidToUse, 'acw_attempts'), {
        userId: uidToUse,
        userEmail: user?.email ?? 'invitado@visitante.com',
        userName: isGuest ? 'Invitado' : (user?.displayName || ''),
        isGuest: isGuest,
        scenarioId: scenario!.id,
        scenarioTitle: scenario!.title,
        timeSpent: Math.round(finalMs / 1000),
        lobId: userLob,
        inputs: { contactReason: selectedReason, comment, action: selectedAction },
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error saving ACW attempt:', e);
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const filteredReasons = CONTACT_REASONS.filter(r =>
    r.toLowerCase().includes(reasonSearch.toLowerCase())
  );

  const fieldsEnabled = state === 'acw';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-m3-primary" size={40} /></div>;

  if (allScenarios.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 text-center p-8 bg-[#0A0A0A]">
        <div className="p-5 bg-orange-900/20 rounded-3xl animate-pulse"><Timer className="text-orange-500" size={48} /></div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Sin escenarios disponibles</h2>
          <p className="text-gray-400 max-w-sm">No se encontraron escenarios de ACW para el área {userLob?.toUpperCase()}.</p>
        </div>
        
        <div className="max-w-xs w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-mono text-left text-gray-400">
          <p className="text-orange-500 mb-1">Status de Rescate ACW:</p>
          <p>• LOB asignado: {userLob} ... OK</p>
          <p>• El simulador solo muestra escenarios relevantes para tu equipo.</p>
        </div>
      </div>
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (state === 'lobby') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8 bg-[#0A0A0A] relative pb-40">
        <div className="max-w-xl w-full text-center bg-[#0A0A0A]/80 backdrop-blur-2xl border border-orange-500/20 rounded-3xl p-10 shadow-[0_0_50px_rgba(249,115,22,0.1)] relative overflow-hidden text-white">
          <div className="relative mx-auto w-28 h-28 flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping" />
            <div className="relative p-6 bg-orange-500/10 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.2)]">
              <Shuffle size={44} className="text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-1.5 bg-orange-500/20 rounded-lg"><Zap className="text-orange-400" size={12} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Simulador ACW — Area {userLob?.toUpperCase()}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-wide text-white">Desafío Aleatorio</h1>
          <p className="text-gray-400 mb-10 max-w-sm mx-auto text-sm leading-relaxed">
            Recibirás un escenario sorpresa. Cuando finalice tu intervención, presiona <b>Colgar</b> para detonar el contador.
          </p>

          <button
            onClick={handleStartChallenge}
            disabled={allScenarios.length === 0}
            className="w-full py-5 bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:grayscale text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-[0_15px_40px_rgba(249,115,22,0.3)] shrink-0 active:scale-95 active:shadow-none border-none"
          >
            {allScenarios.length === 0 ? <Loader2 className="animate-spin" /> : <Play size={24} fill="currentColor" />}
            INICIAR ENTRENAMIENTO
          </button>
        </div>
      </div>
    );
  }

  // ── CHALLENGE HUD ────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      
      {/* Background Gradient Dynamic */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${state === 'listening' ? 'bg-blue-900/10' : 'bg-green-900/10'}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,10,10,0)_0%,rgba(5,5,5,1)_100%)] pointer-events-none" />

      {/* ── Top Bar HUD ── */}
      <div className="w-full flex items-center justify-between px-8 py-6 relative z-20 backdrop-blur-md border-b border-white/5 bg-black/20">
         <div className="flex items-center gap-6">
            <button onClick={() => setState('lobby')} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 shadow-lg">
              <ChevronLeft size={20} />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Escenario Activo</span>
              <h2 className="text-xl font-black tracking-tight text-white">{scenario?.title}</h2>
            </div>
         </div>

         <div className="flex items-center gap-10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Tiempo Transcurrido</span>
              <div className={`text-4xl font-mono font-black transition-colors ${elapsed > 30000 ? 'text-red-500' : 'text-blue-400 opacity-60'} drop-shadow-[0_0_20px_currentColor]`}>
                {formatTime(elapsed)}s
              </div>
            </div>
         </div>
      </div>

      {/* ── Body (HUD 2 Columns) ── */}
      <div className="flex-1 w-full max-w-full mx-auto relative z-10 px-4 md:px-10 py-4 h-full flex flex-col overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-full flex-1 overflow-hidden">

          {/* LEFT: Reproductor Multimedia (Fixed/Sticky Area) */}
          <div className="lg:col-span-5 flex flex-col h-full overflow-hidden">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-2 w-full flex-1 relative overflow-hidden backdrop-blur-md mb-6 shadow-2xl">
               <video ref={videoRef} src={scenario?.videoUrl} controls={state === 'listening'}
                 className="absolute inset-0 w-full h-full object-contain bg-black rounded-2xl" />
               
               {/* Overlay status sutil */}
               <div className="absolute top-4 left-4 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-black text-white uppercase tracking-widest pointer-events-none">
                 Reproductor de Evidencia
               </div>
            </div>

            {/* 📞 COLGAR LLAMADA button */}
            {state === 'listening' ? (
              <button
                onClick={handleHangUp}
                className="w-full flex shrink-0 items-center justify-center gap-4 py-6 bg-red-500 text-white shadow-[0_0_50px_rgba(239,68,68,0.4)] hover:bg-red-600 rounded-[2rem] font-black text-xl transition-all active:scale-95 animate-pulse uppercase tracking-[0.2em] border-none"
              >
                <PhoneOff size={28} /> FINALIZAR CONTACTO
              </button>
            ) : (
              <div className="w-full shrink-0 px-6 py-6 bg-white/5 border border-white/10 rounded-[2rem] text-gray-400 font-black text-lg uppercase tracking-[0.2em] text-center flex items-center justify-center gap-4 backdrop-blur-sm">
                <div className="w-3 h-3 rounded-full bg-red-500/50" /> CONTACTO FINALIZADO
              </div>
            )}
          </div>

          {/* RIGHT: Formulario HeroCare (No scroll area except internal) */}
          <div className="lg:col-span-7 h-full flex flex-col bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] lg:p-10 p-6 shadow-2xl relative overflow-hidden">
            
            {/* ── RESULT MODAL INMERSIVO ── */}
            {state === 'result' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center bg-[#0A0A0A]/98 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 animate-in fade-in duration-500">
                <div className="p-8 rounded-full mb-6 bg-green-500/10 border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                  <Trophy size={64} className="text-green-500" />
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Análisis Completado</h2>
                <div className="flex flex-col items-center gap-2 mb-10">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tiempo de Tipificación</span>
                  <div className="flex items-center gap-4 px-10 py-6 bg-green-500/5 rounded-[3rem] border border-green-500/20 shadow-inner">
                    <Clock size={32} className="text-green-500" />
                    <span className="font-mono font-black text-6xl text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]">{formatTime(finalTimeMs)}s</span>
                  </div>
                </div>
                
                {finalTimeMs < 30000
                  ? <p className="text-sm font-black tracking-[0.3em] uppercase text-green-400 mb-2">🏆 E-SPORTS SPEED: EXCELENTE</p>
                  : finalTimeMs < 60000
                  ? <p className="text-sm font-black tracking-[0.3em] uppercase text-yellow-400 mb-2">⚠️ RITMO ACEPTABLE</p>
                  : <p className="text-sm font-black tracking-[0.3em] uppercase text-red-500 mb-2">❌ FUERA DE SLA: LENTO</p>
                }
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-12">{isSavingAttempt ? 'Sincronizando con Servidor...' : 'Registro Almacenado en Perfil'}</p>
                
                <div className="flex gap-4 w-full max-w-sm">
                  <button onClick={() => { setElapsed(0); setFinalTimeMs(0); setScenario(null); setState('lobby'); }}
                    className="flex-1 py-4 px-6 border border-white/10 bg-white/5 text-gray-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">
                    Volver
                  </button>
                  <button onClick={() => { setElapsed(0); setFinalTimeMs(0); handleStartChallenge(); }}
                    className="flex-1 py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-[0_10px_30px_rgba(59,130,246,0.2)] transition-all active:scale-95">
                    Reiniciar <ChevronRight size={16} className="inline ml-1" />
                  </button>
                </div>
              </div>
            )}

            <div className={`flex flex-col h-full overflow-hidden justify-between transition-all duration-700 ${state === 'result' ? 'invisible scale-95 opacity-0' : state === 'listening' ? 'opacity-20 pointer-events-none blur-md scale-[0.98]' : 'opacity-100 blur-0 scale-100'}`}>
              
               <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse" />
                    <span className="text-[11px] font-black tracking-[0.2em] uppercase text-blue-400">HEROCARE CRM — V4.0</span>
                  </div>
                  <div className="flex gap-6">
                    {scenario?.contextOrderNumber && (
                      <div className="text-right">
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1 tracking-widest">Order ID</p>
                        <p className="font-mono text-xs font-bold text-gray-200 bg-white/5 px-2 py-1 rounded border border-white/10 select-all">{scenario?.contextOrderNumber}</p>
                      </div>
                    )}
                    {scenario?.contextTicketId && (
                      <div className="text-right pl-6 border-l border-white/10">
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1 tracking-widest">Ticket Ref</p>
                        <p className="font-mono text-xs font-bold text-gray-200 bg-white/5 px-2 py-1 rounded border border-white/10 select-all">{scenario?.contextTicketId}</p>
                      </div>
                    )}
                  </div>
               </div>

               {/* Area Scrolleable Interna Form */}
               <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pr-2">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                      Widget Toku Notas
                    </label>
                    <textarea rows={1} disabled={!fieldsEnabled} value={nota} onChange={e => setNota(e.target.value)}
                      placeholder="Escribe puntos clave durante la llamada..."
                      className="w-full px-5 py-4 text-sm bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white transition-all placeholder:text-gray-600 shadow-inner"
                    />
                  </div>

                  {formError && (
                    <div className="px-5 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-400 font-bold tracking-widest uppercase animate-slide-in">
                      ⚠️ {formError}
                    </div>
                  )}

                  <div className="space-y-3 relative">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                      PCR3 / Motivo de Contacto <span className="text-red-500">*</span>
                    </label>
                    <button type="button" disabled={!fieldsEnabled} onClick={() => setShowReasonDropdown(v => !v)}
                      className="w-full px-5 py-4 text-sm bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between text-left focus:border-blue-500 transition-all text-white disabled:opacity-40 outline-none shadow-inner group">
                      <span className={selectedReason ? 'truncate' : 'text-gray-600 truncate'}>{selectedReason || 'Seleccionar Categoría Oficial...'}</span>
                      <Search size={18} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                    </button>
                    {showReasonDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-3 bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-[100] overflow-hidden backdrop-blur-3xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 bg-white/5">
                          <input autoFocus type="text" value={reasonSearch} onChange={e => setReasonSearch(e.target.value)} placeholder="Ej: Queja, Login, Gestión..."
                            className="w-full px-5 py-4 text-sm bg-black/40 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white placeholder:text-gray-600 shadow-inner" />
                        </div>
                        <div className="max-h-56 overflow-y-auto no-scrollbar py-2">
                          {filteredReasons.length === 0
                            ? <p className="text-center text-[11px] text-gray-500 py-6 uppercase tracking-widest">Sin Coincidencias</p>
                            : filteredReasons.map((r, i) => (
                              <button key={i} type="button" onClick={() => { setSelectedReason(r); setShowReasonDropdown(false); setReasonSearch(''); }}
                                className="w-full px-6 py-3.5 text-xs text-left hover:bg-blue-600 text-white text-gray-400 transition-all border-b border-white/5 font-medium">
                                {r}
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                      HC / Comentario Detallado <span className="text-red-500">*</span>
                    </label>
                    <textarea rows={4} disabled={!fieldsEnabled} value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Describe la resolución del caso de forma técnica..."
                      className="w-full px-5 py-4 text-sm bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white transition-all placeholder:text-gray-600 shadow-inner min-h-[120px]"
                    />
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                      Estado Final del Contacto <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {['Resolver', 'Transferir', 'Escalar'].map(opt => (
                        <label key={opt} className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${fieldsEnabled ? 'cursor-pointer' : 'opacity-20 cursor-not-allowed'} ${
                          selectedAction === opt
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                            : 'border-white/5 bg-white/5 text-gray-600 hover:border-white/20'
                        }`}>
                          <input type="radio" name="finalAction" disabled={!fieldsEnabled} value={opt} checked={selectedAction === opt} onChange={() => setSelectedAction(opt)} className="sr-only" />
                          <div className={`w-2 h-2 rounded-full mb-2 transition-colors ${selectedAction === opt ? 'bg-blue-400' : 'bg-gray-700'}`} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
               </div>

               <button onClick={handleClose} disabled={!fieldsEnabled}
                 className="w-full mt-10 py-5 bg-green-500 hover:bg-green-400 disabled:opacity-30 disabled:grayscale text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-[0_15px_40px_rgba(34,197,94,0.3)] shrink-0 active:scale-95 active:shadow-none border-none">
                 <CheckCircle2 size={24} /> COMPLETAR TIPIFICACIÓN
               </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
