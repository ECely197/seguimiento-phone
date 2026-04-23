import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, setDoc, getDocs, orderBy, query, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth, appId } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  Timer, Play, ChevronRight, CheckCircle2, Zap, Clock,
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

          <div className="flex items-center justify-center gap-6 mb-12 w-full px-4">
            <div className="flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-5 w-1/2 shadow-lg text-white">
               <p className="text-3xl font-black">{allScenarios.length}</p>
               <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-2">Escenarios</p>
            </div>
            <div className="flex flex-col items-center bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 w-1/2 shadow-lg">
               <p className="text-3xl font-black text-orange-500">30s</p>
               <p className="text-[10px] font-bold tracking-widest text-orange-400 uppercase mt-2">Meta ACW</p>
            </div>
          </div>

          <button onClick={handleStartChallenge}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-lg py-4 rounded-2xl shadow-[0_10px_30px_rgba(249,115,22,0.4)] hover:shadow-[0_10px_40px_rgba(249,115,22,0.6)] hover:-translate-y-1 active:scale-95 transition-all animate-pulse flex items-center justify-center gap-3">
            <Play size={24} fill="white" /> INICIAR DESAFÍO
          </button>
        </div>
      </div>
    );
  }

  // ── PRACTICE SCREEN ────────────────────────────────────────────────────────
  const activeScenario = scenario!;

  return (
    <div className={`min-h-[calc(100vh-120px)] flex flex-col text-gray-200 pb-32 transition-colors duration-1000 relative overflow-hidden ${
      state === 'acw'
        ? elapsed > 30000 ? 'bg-gradient-to-b from-red-900/30 to-[#0A0A0A] animate-pulse'
        : elapsed > 15000 ? 'bg-gradient-to-b from-yellow-900/20 to-[#0A0A0A]'
        : 'bg-gradient-to-b from-green-900/20 to-[#0A0A0A]'
      : 'bg-[#0A0A0A]'
    }`}>
      
      {/* ── Floating ACW HUD Chronometer ── */}
      {/* ── Floating ACW HUD Chronometer ── */}
      <div className={`fixed top-6 right-6 md:top-10 md:right-10 z-[110] bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl px-6 py-3 shadow-2xl transition-colors duration-500 font-mono text-4xl md:text-5xl font-black drop-shadow-[0_0_15px_currentColor] ${
        state === 'listening' ? 'text-green-400/50'
        : state === 'acw'
          ? elapsed > 30000 ? 'text-red-500 animate-bounce'
            : elapsed > 15000 ? 'text-yellow-400'
            : 'text-green-400'
        : 'text-gray-500'
      }`}>
        {formatTime(state === 'result' ? finalTimeMs : elapsed)}
      </div>

      {/* ── Header ── */}
      <div className="px-6 py-4 bg-[#111]/40 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap z-10 relative">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-orange-500/20 rounded-xl border border-orange-500/30"><Shuffle size={18} className="text-orange-500" /></div>
          <div>
            <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mb-1.5 drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]">Match Aleatorio ({userLob})</p>
            <h1 className="text-base font-bold text-white leading-tight">{activeScenario.title}</h1>
          </div>
        </div>

        {/* Phase indicator limited to badge */}
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border ${
            state === 'listening' ? 'bg-blue-900/40 border-blue-500 text-blue-300'
            : state === 'acw' ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse'
            : 'bg-green-900/40 border-green-500 text-green-300'
          }`}>
            {state === 'listening' ? '📞 EN CURSO' : state === 'acw' ? '⚡ ACW ACTIVO' : '✅ COMPLETADO'}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto relative z-10 px-4 md:px-6 py-4 min-h-0 flex flex-col pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 w-full flex-1 min-h-[calc(100vh-200px)]">

          {/* LEFT: Video/Audio + Botón destructivo (Compacto) */}
          <div className="lg:col-span-5 flex flex-col h-full min-h-0 text-gray-200">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-2 w-full shadow-sm flex items-center justify-center flex-1 min-h-0 min-h-[250px] relative overflow-hidden backdrop-blur-md mb-4">
               <video ref={videoRef} src={activeScenario.videoUrl} controls
                 className="absolute inset-0 w-full h-full object-contain bg-[#111] rounded-2xl" />
            </div>

            {/* 📞 COLGAR LLAMADA button */}
            {state === 'listening' ? (
              <button
                onClick={handleHangUp}
                className="w-full flex shrink-0 items-center justify-center gap-3 py-3 md:py-4 bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white hover:border-transparent rounded-xl font-bold text-lg shadow-sm transition-all active:scale-95 animate-pulse uppercase tracking-widest"
              >
                <PhoneOff size={22} /> FINALIZAR CONTACTO
              </button>
            ) : (
              <div className="w-full shrink-0 px-4 py-3 md:py-4 bg-white/5 border border-white/10 rounded-xl text-gray-500 font-bold text-sm uppercase tracking-widest text-center flex items-center justify-center gap-2">
                <PhoneOff size={18} /> Contacto Desconectado
              </div>
            )}
          </div>

          {/* RIGHT: HeroCare Simulator (Compacto sin scroll) */}
          <div className="lg:col-span-7 relative h-full flex flex-col bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl lg:p-6 p-4 overflow-hidden shadow-xl min-h-[500px]">

            {/* ── RESULT MODAL ── */}
            {state === 'result' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-[#0A0A0A]/95 backdrop-blur-2xl rounded-3xl border border-white/10">
                <div className="p-4 md:p-6 rounded-full mb-4 bg-green-900/30 border border-green-500/50 shadow-sm">
                  <Trophy size={48} className="text-green-500" />
                </div>
                <h2 className="text-3xl font-black text-white mb-2">¡Tipi Finalizado!</h2>
                <div className="flex items-center gap-3 px-6 py-4 bg-green-900/20 rounded-[24px] border border-green-500/30 mb-6 shadow-sm">
                  <Clock size={28} className="text-green-500" />
                  <span className="font-mono font-black text-5xl text-green-400 drop-shadow-[0_0_15px_currentColor]">{formatTime(finalTimeMs)}s</span>
                </div>
                {finalTimeMs < 30000
                  ? <p className="text-xs md:text-sm font-black tracking-widest uppercase text-green-400 mb-2 drop-shadow-md">🏆 ¡Meta cumplida! E-Sports Speed.</p>
                  : finalTimeMs < 60000
                  ? <p className="text-xs md:text-sm font-black tracking-widest uppercase text-yellow-400 mb-2 drop-shadow-md">⚠️ Aceptable. Refina tipificación.</p>
                  : <p className="text-xs md:text-sm font-black tracking-widest uppercase text-red-500 mb-2 drop-shadow-md">❌ Rendimiento Pobre. Lento.</p>
                }
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-8">{isSavingAttempt ? '💾 SINCRONIZANDO...' : '✅ REGISTRADO OFICIALMENTE'}</p>
                <div className="flex gap-3 w-full max-w-sm">
                  <button onClick={() => { setElapsed(0); setFinalTimeMs(0); setScenario(null); setState('lobby'); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-white/20 bg-white/5 text-gray-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all hover:-translate-y-1">
                    <Shuffle size={14} /> Salir
                  </button>
                  {allScenarios.length > 1 && (
                    <button onClick={() => { setElapsed(0); setFinalTimeMs(0); handleStartChallenge(); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-400 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:-translate-y-1 transition-all">
                      Reintentar <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Formulario HeroCare Compacto ── */}
            <div className={`flex flex-col h-full overflow-y-auto no-scrollbar justify-between transition-all duration-300 ${state === 'result' ? 'invisible' : state === 'listening' ? 'opacity-30 pointer-events-none blur-[1px] grayscale-[0.5]' : 'opacity-100 blur-0 grayscale-0'}`}>

              {/* ID de Sistema en Header */}
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                  <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">HeroCare CRM</span>
                </div>
                <div className="flex gap-3">
                  {activeScenario.contextOrderNumber && (
                    <div className="text-right">
                      <p className="text-[9px] font-black text-gray-500 uppercase">Order #</p>
                      <p className="font-mono text-xs font-bold text-gray-300 hover:text-blue-500 cursor-copy" onClick={() => navigator.clipboard.writeText(activeScenario.contextOrderNumber!)}>{activeScenario.contextOrderNumber}</p>
                    </div>
                  )}
                  {activeScenario.contextTicketId && (
                    <div className="text-right pl-3 border-l border-white/10">
                      <p className="text-[9px] font-black text-gray-500 uppercase">Ticket ID</p>
                      <p className="font-mono text-xs font-bold text-gray-300 hover:text-blue-500 cursor-copy" onClick={() => navigator.clipboard.writeText(activeScenario.contextTicketId!)}>{activeScenario.contextTicketId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Toku Pre-Input */}
              <div className="mb-3 shrink-0">
                <label className="block text-[9px] font-black text-purple-400 mb-1.5 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">
                  Widget Toku En Vivo
                </label>
                <textarea rows={1} disabled={!fieldsEnabled} value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="Detalles rápidos..."
                  className="w-full px-3 py-2 text-sm bg-[#111] border border-white/10 rounded-lg resize-none outline-none focus:border-orange-500 focus:ring-1 text-white transition-all placeholder:text-gray-600 h-10 shadow-inner"
                />
              </div>

              {formError && (
                <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-500/50 rounded-lg text-[10px] text-red-400 font-black tracking-widest uppercase truncate shrink-0">
                  ⚠️ {formError}
                </div>
              )}

              {/* Tipificación Oficial - PCR3 */}
              <div className="mb-3 relative shrink-0">
                <label className="block text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">
                  Motivo de Contacto / PCR3 <span className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">*</span>
                </label>
                <button type="button" disabled={!fieldsEnabled} onClick={() => setShowReasonDropdown(v => !v)}
                  className="w-full px-3 py-2.5 text-sm bg-[#111] border border-white/10 rounded-lg flex items-center justify-between text-left focus:border-orange-500 transition-all text-white disabled:opacity-40 outline-none shadow-inner">
                  <span className={selectedReason ? 'truncate' : 'text-gray-600 truncate'}>{selectedReason || 'ABRIR BUSCADOR PCR3...'}</span>
                  <Search size={14} className="text-gray-500 shrink-0 ml-2" />
                </button>
                {showReasonDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] z-20 overflow-hidden backdrop-blur-2xl">
                    <div className="p-2 border-b border-white/10">
                      <input autoFocus type="text" value={reasonSearch} onChange={e => setReasonSearch(e.target.value)} placeholder="Buscar..."
                        className="w-full px-3 py-2.5 text-sm bg-[#111] border border-white/10 rounded-lg outline-none focus:border-orange-500 text-white placeholder:text-gray-600" />
                    </div>
                    <div className="max-h-32 overflow-y-auto no-scrollbar">
                      {filteredReasons.length === 0
                        ? <p className="text-center text-[10px] text-gray-500 py-4">VACÍO</p>
                        : filteredReasons.map((r, i) => (
                          <button key={i} type="button" onClick={() => { setSelectedReason(r); setShowReasonDropdown(false); setReasonSearch(''); }}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-orange-500/20 hover:text-orange-400 text-gray-400 transition-colors border-b border-white/5">
                            {r}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* Comentarios HC */}
              <div className="mb-4 flex-1 flex flex-col min-h-[60px]">
                <label className="block text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-widest shrink-0">
                  Comentario Exhaustivo <span className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">*</span>
                </label>
                <textarea rows={3} disabled={!fieldsEnabled} value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Historia del caso..."
                  className="w-full flex-1 max-h-24 min-h-[4rem] px-3 py-2.5 text-sm bg-[#111] border border-white/10 rounded-lg resize-none outline-none focus:border-orange-500 focus:ring-1 text-white transition-all placeholder:text-gray-600 shadow-inner"
                />
              </div>

              {/* Action Buttons Tighly Packed */}
              <div className="shrink-0 mb-4">
                <label className="block text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">
                  Resolución <span className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">*</span>
                </label>
                <div className="flex gap-2">
                  {['Resolver', 'Transferir', 'Escalar'].map(opt => (
                    <label key={opt} className={`flex-1 flex items-center justify-center p-2 rounded-lg border text-xs font-black uppercase tracking-widest transition-all ${fieldsEnabled ? 'cursor-pointer hover:border-orange-500/50' : 'opacity-40 cursor-not-allowed'} ${
                      selectedAction === opt
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                        : 'border-white/10 bg-white/5 text-gray-500'
                    }`}>
                      <input type="radio" name="finalAction" disabled={!fieldsEnabled} value={opt} checked={selectedAction === opt} onChange={() => setSelectedAction(opt)} className="sr-only" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={handleClose} disabled={!fieldsEnabled}
                className="w-full mt-auto py-3 bg-green-500 hover:bg-green-400 disabled:opacity-20 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(34,197,94,0.3)] shrink-0 active:scale-[0.98]">
                <CheckCircle2 size={18} /> GUARDAR TIPIFICACIÓN
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
