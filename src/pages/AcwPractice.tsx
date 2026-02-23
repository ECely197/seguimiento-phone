import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import {
  Timer, Play, ChevronRight, CheckCircle2,
  Zap, Clock, Search, MessageSquare, Loader2, Trophy
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcwScenario {
  id: string;
  title: string;
  videoUrl: string;
}

type PracticeState = 'idle' | 'panel-a' | 'panel-b' | 'result';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (ms: number) => {
  const secs = Math.floor(ms / 1000);
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function AcwPractice() {
  const [scenarios, setScenarios] = useState<AcwScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [state, setState] = useState<PracticeState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Panel A
  const [nota, setNota] = useState('');

  // Panel B
  const [reasonSearch, setReasonSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [comment, setComment] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [panelBError, setPanelBError] = useState('');

  // Result
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);

  // Fetch scenarios
  useEffect(() => {
    const fetch = async () => {
      try {
        const q = query(collection(db, 'acw_scenarios'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        setScenarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcwScenario)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const scenario = scenarios[currentIndex];

  // ── Timer ─────────────────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStart = () => {
    setNota('');
    setReasonSearch('');
    setSelectedReason('');
    setComment('');
    setSelectedAction('');
    setPanelBError('');
    setElapsed(0);
    setState('panel-a');
    startTimer();
    setTimeout(() => videoRef.current?.play(), 100);
  };

  const handleConfirm = () => setState('panel-b');

  const handleClose = async () => {
    if (!selectedReason) { setPanelBError('Selecciona un motivo de contacto.'); return; }
    if (!comment.trim()) { setPanelBError('El comentario es obligatorio.'); return; }
    if (!selectedAction) { setPanelBError('Selecciona una opción de finalización.'); return; }
    setPanelBError('');

    const finalMs = stopTimer();
    videoRef.current?.pause();
    setFinalTimeMs(finalMs);
    setState('result');

    // Save attempt to Firestore
    setIsSavingAttempt(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'acw_attempts'), {
        userId: user?.uid ?? 'unknown',
        userEmail: user?.email ?? 'unknown',
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        timeSpent: Math.round(finalMs / 1000),
        inputs: {
          contactReason: selectedReason,
          comment,
          action: selectedAction,
        },
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error saving ACW attempt:', e);
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const handleRetry = () => {
    setElapsed(0);
    setFinalTimeMs(0);
    setState('idle');
  };

  const handleNext = () => {
    setElapsed(0);
    setFinalTimeMs(0);
    setCurrentIndex(i => (i + 1) % scenarios.length);
    setState('idle');
  };

  // Reason dropdown options derived from all scenario titles (coach can type anything)
  const CONTACT_REASONS = [
    'Consulta posterior a la entrega',
    'Local cerrado',
    'Dirección incorrecta',
    'Producto dañado',
    'Pedido no recibido',
    'Cambio de dirección',
    'Cancelación de pedido',
    'Otro',
  ];
  const filteredReasons = CONTACT_REASONS.filter(r =>
    r.toLowerCase().includes(reasonSearch.toLowerCase())
  );

  // ── Loading / Empty ────────────────────────────────────────────────────────
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-m3-primary" size={40} /></div>;

  if (!scenario) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="p-5 bg-m3-primary/10 rounded-3xl"><Timer className="text-m3-primary" size={48} /></div>
        <h2 className="text-2xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Sin escenarios disponibles</h2>
        <p className="text-m3-secondary/60 dark:text-m3-on-surface-dark/50 max-w-sm">El administrador aún no ha cargado escenarios. Vuelve pronto.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full flex flex-col bg-gray-50 dark:bg-[#121212]">

      {/* ── Top Header ── */}
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="p-1 bg-orange-100 dark:bg-orange-900/30 rounded-lg"><Zap className="text-orange-500" size={14} /></div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Simulador ACW</span>
          </div>
          <h1 className="text-lg font-bold text-m3-secondary dark:text-m3-on-surface-dark">{scenario.title}</h1>
          <p className="text-xs text-gray-400">Escenario {currentIndex + 1} de {scenarios.length}</p>
        </div>

        {/* Stopwatch */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-mono text-2xl font-bold transition-all duration-200 ${
          state === 'panel-a' || state === 'panel-b'
            ? elapsed > 50000 ? 'bg-red-500 text-white animate-pulse'
              : elapsed > 25000 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-white/5 text-gray-400'
        }`}>
          <Clock size={18} strokeWidth={2.5} />
          {formatTime(state === 'result' ? finalTimeMs : elapsed)}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* LEFT: Video */}
        <div className="lg:w-[38%] bg-black flex items-center justify-center relative min-h-[200px]">
          <video
            ref={videoRef}
            src={scenario.videoUrl}
            controls={state !== 'idle'}
            className="w-full h-full object-contain max-h-[300px] lg:max-h-full"
          />
          {state === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm gap-4">
              <button onClick={handleStart} className="flex items-center gap-3 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg shadow-2xl transition-all hover:scale-105 active:scale-95">
                <Play size={24} fill="white" /> Comenzar Práctica
              </button>
              <p className="text-white/50 text-xs">El cronómetro iniciará automáticamente</p>
            </div>
          )}
        </div>

        {/* RIGHT: HeroCare Simulator */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto relative">

          {/* ── RESULT MODAL ── */}
          {state === 'result' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-green-50 dark:bg-green-900/20">
              <div className="p-4 rounded-3xl mb-4 bg-green-100 dark:bg-green-900/40">
                <Trophy size={48} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">¡Práctica Completada!</h2>
              <div className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-black/20 rounded-2xl border border-green-200 dark:border-green-800/30 mb-6 shadow-sm">
                <Clock size={20} className="text-green-600 dark:text-green-400" />
                <span className="font-mono font-bold text-3xl text-green-700 dark:text-green-300">
                  {formatTime(finalTimeMs)}s
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {isSavingAttempt ? '💾 Guardando tu intento...' : '✅ Intento registrado'}
              </p>
              <p className="text-xs text-gray-400 mb-6">El supervisor podrá ver tu tiempo en el panel de métricas.</p>
              <div className="flex gap-3">
                <button onClick={handleRetry} className="px-5 py-2.5 border border-gray-200 dark:border-white/10 text-m3-secondary dark:text-m3-on-surface-dark rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all bg-white dark:bg-transparent">
                  Reintentar
                </button>
                {scenarios.length > 1 && (
                  <button onClick={handleNext} className="flex items-center gap-2 px-5 py-2.5 bg-m3-primary text-white rounded-xl font-bold text-sm hover:bg-m3-primary/90 shadow-md transition-all">
                    Siguiente <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── HeroCare Mockup ── */}
          <div className={state === 'result' ? 'invisible' : ''}>
            {/* CRM top bar */}
            <div className="bg-[#1a3a6b] text-white px-4 py-2 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide">HeroCare CRM</span>
              </div>
              <span className="text-xs text-white/50 font-mono">TICKET #{Math.floor(10000 + currentIndex * 777)}</span>
            </div>

            <div className="bg-white dark:bg-[#252525] rounded-b-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/10">

                {/* PANEL A */}
                <div className="md:col-span-2 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare size={16} className="text-[#1a3a6b] dark:text-blue-400" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Widget de Agente</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 mb-4 text-xs">
                    <p className="text-gray-400 mb-1">Cliente en línea</p>
                    <p className="font-bold text-m3-secondary dark:text-m3-on-surface-dark">Cliente Anónimo</p>
                    <p className="text-gray-400 mt-1">Cola: Soporte General</p>
                  </div>

                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Nota Interna (opcional)</label>
                  <textarea
                    rows={3}
                    disabled={state === 'idle' || state === 'panel-b'}
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Notas para el equipo..."
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-40 disabled:cursor-not-allowed text-m3-secondary dark:text-m3-on-surface-dark transition-all mb-4"
                  />
                  <button
                    disabled={state !== 'panel-a'}
                    onClick={handleConfirm}
                    className="w-full py-2.5 bg-[#1a3a6b] hover:bg-[#14306b] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Confirmar y Tipificar
                  </button>
                  {state === 'idle' && <p className="text-center text-xs text-gray-400 mt-3">Presiona "Comenzar Práctica" para activar</p>}
                  {state === 'panel-b' && <p className="text-center text-xs text-green-500 mt-3 font-semibold">✔ Nota confirmada — completa el Panel B</p>}
                </div>

                {/* PANEL B */}
                <div className={`md:col-span-3 p-5 transition-all duration-300 ${state === 'panel-b' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Cerrar Ticket</span>
                    </div>
                    {state === 'panel-b' && <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">En curso</span>}
                  </div>

                  {panelBError && (
                    <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
                      ⚠️ {panelBError}
                    </div>
                  )}

                  {/* Motivo de Contacto Dropdown */}
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Motivo de Contacto *</label>
                  <div className="relative mb-4">
                    <button
                      type="button"
                      onClick={() => setShowReasonDropdown(v => !v)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-left flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-all text-m3-secondary dark:text-m3-on-surface-dark"
                    >
                      <span className={selectedReason ? '' : 'text-gray-400'}>{selectedReason || 'Selecciona un motivo...'}</span>
                      <Search size={14} className="text-gray-400 flex-shrink-0" />
                    </button>
                    {showReasonDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                        <div className="p-2 border-b border-gray-100 dark:border-white/5">
                          <input
                            autoFocus
                            type="text"
                            value={reasonSearch}
                            onChange={e => setReasonSearch(e.target.value)}
                            placeholder="Buscar motivo..."
                            className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-white/5 rounded-lg outline-none border border-gray-200 dark:border-white/10 text-m3-secondary dark:text-m3-on-surface-dark"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {filteredReasons.length === 0
                            ? <p className="text-center text-xs text-gray-400 py-4">Sin resultados</p>
                            : filteredReasons.map(r => (
                              <button key={r} type="button" onClick={() => { setSelectedReason(r); setShowReasonDropdown(false); setReasonSearch(''); }}
                                className="w-full px-4 py-2.5 text-xs text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 text-m3-secondary dark:text-m3-on-surface-dark transition-colors">
                                {r}
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comentario */}
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Comentario *</label>
                  <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Describe el caso brevemente..."
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-400/50 text-m3-secondary dark:text-m3-on-surface-dark transition-all mb-4"
                  />

                  {/* Radio: Finalizar Contacto */}
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Finalizar Contacto *</label>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {['Resolver', 'Transferir', 'Escalar'].map(opt => (
                      <label key={opt} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all ${
                        selectedAction === opt
                          ? 'border-[#1a3a6b] bg-[#1a3a6b]/10 dark:bg-blue-900/30 text-[#1a3a6b] dark:text-blue-300'
                          : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'
                      }`}>
                        <input type="radio" name="finalAction" value={opt} checked={selectedAction === opt} onChange={() => setSelectedAction(opt)} className="sr-only" />
                        <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${selectedAction === opt ? 'border-[#1a3a6b] bg-[#1a3a6b]' : 'border-gray-300 dark:border-white/30'}`} />
                        {opt}
                      </label>
                    ))}
                  </div>

                  <button onClick={handleClose}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.01] active:scale-100">
                    <CheckCircle2 size={18} /> Cerrar Ticket y Finalizar ACW
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
