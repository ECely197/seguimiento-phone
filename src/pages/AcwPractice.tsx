import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, setDoc, getDocs, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  Timer, Play, ChevronRight, CheckCircle2, Zap, Clock,
  Search, Loader2, Trophy, Copy, Check, Shuffle, PhoneOff
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcwScenario {
  id: string;
  title: string;
  videoUrl: string;
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

// ── Contact Reasons ───────────────────────────────────────────────────────────
const CONTACT_REASONS = [
  "Queja sobre la gestión del Account management",
  "Solicitud de reunión con el comercial",
  "Consulta sobre el servicio de pick-up",
  "Consulta del servicio de logística",
  "Demanda de motorizados",
  "Consultas generales relacionadas con evaluaciones de clientes",
  "Socio solicitado para eliminar la evaluación del cliente",
  "Solicitud para comentar sobre la evaluación del cliente",
  "Motorizado",
  "Proceso",
  "Sistema",
  "Motorizado",
  "Proceso",
  "Sistema",
  "Spam",
  "Consulta sobre caso anterior",
  "Solicitud de bolsas con marca",
  "Solicitud de bolsas y papel de impresión",
  "Solicitud de cartelería",
  "Solicitud de papel de impresión",
  "Aguardando motorizado disponible",
  "Consulta Sobre Donde Está mi Cadete",
  "Consulta Posterior a la Entrega",
  "Consulta Posterior a la Entrega",
  "Falta de información de la orden",
  "Modificación de la dirección de entrega",
  "Consultas sobre el proceso de pago",
  "Partner no recibió el pago",
  "Partner recibió pago incorrecto",
  "Reconciliación de pagos",
  "Consultas por términos de contrato",
  "Renegociación de comisión",
  "Renegociación general",
  "Consulta sobre estado de Onboarding",
  "Solicitud de ingreso de nuevo partner",
  "Interés en el posicionamiento",
  "Interés en fotos de productos",
  "Interés en participar en campañas comerciales",
  "Problemas con el posicionamiento",
  "Solicitud de insumos",
  "Terminación de campañas comerciales",
  "Terminación de posiciones privilegiadas",
  "Problema con la oferta",
  "Terminación por cambio de dueño",
  "Consulta de promoción (financiada por el vendor)",
  "Consulta de cargos de NCR",
  "Interés en Dine-In",
  "Terminación de Dine-In",
  "Local quiere abandonar la plataforma",
  "Terminación por cambio de dueño",
  "Terminación por cierre de los partner",
  "Dispositivo no recibe pedidos",
  "Método de transmisión cambió",
  "Otros problemas con la app",
  "Pregunta sobre funcionalidad",
  "No puede iniciar sesión",
  "Falta Factura en el portal",
  "Pregunta sobre funcionalidad",
  "Problema técnico",
  "Problemas con el codigo QR",
  "Impresora dañada",
  "Impresora perdida o robada",
  "No imprime por problemas técnicos",
  "Problemas de conexión",
  "Información incorrecta en la página",
  "Local aparece cerrado",
  "No puede ver su perfil en la página",
  "Zona de entrega incorrecta",
  "Consulta de orden preparada dos veces",
  "Consulta sobre la comisión",
  "Error en factura",
  "Pregunta sobre impuestos",
  "Reclamo de facturación",
  "Solicitud de explicación del cálculo de factura",
  "Solicitud de factura por el partner",
  "Cambio de estado de un pedido",
  "El pedido fue realizado fuera de hora",
  "Falta de información de la orden",
  "Falta de personal de entrega",
  "Falta de productos",
  "Consulta Posterior a la Entrega",
  "Falta información del usuario",
  "Modificación de la dirección de entrega",
  "Mucha demanda en el local",
  "Usuario no aceptó el pedido",
  "Pedido duplicado",
  "Pedido falso",
  "Problema con el cupón",
  "Usuario fuera del área de cobertura",
  "Usuario no aceptó el pedido",
  "Usuario quiere modificar el pedido",
  "Usuario recogió el pedido en el local por mucha demora",
  "Cargador perdido o dañado",
  "Dispositivo dañado",
  "Dispositivo perdido o robado",
  "Local cambió sistema de recepción",
  "Problemas con el dispositivo",
  "Problemas de conexión",
  "Problemas de conexión con SIM Card",
  "Solicitud de recambio de dispositivo",
  "Configurar o cambiar",
  "Problema técnico",
  "Dispositivo está con la pantalla blanca",
  "Cambio de dirección del local",
  "Cambio de dueño del local",
  "Cambio de nombre del local",
  "Actualización de horario en que está operativo",
  "Cambiar de horario temporalmente",
  "Socio solicita apertura por desactivación temporal",
  "Cambio de la cobertura",
  "Cambio del delivery time",
  "Cambio en costo de envío",
  "Cambio en el importe mínimo para pedido",
  "Cambio de Metodo de Pago",
  "Activar/desactivar pick-up",
  "Adicionar categoría del menú",
  "Agregar items o ingredientes",
  "Cambiar configuración de menú",
  "Cambio completo del menú",
  "Cambiar o subir foto actualizada",
  "Cambiar o subir imagen del listado",
  "Cambiar o subir logo",
  "Cambio de precios",
  "Descripción",
  "Eliminar u ocultar categoría o producto",
  "Consulta sobre donde está mi cadete",
  "Aguardando motorizado disponible",
  "No puede contactar al usuario",
  "Problema con la dirección del usuario",
  "Repartidor no pagó el pedido",
  "Repartidor olvidó algunos productos",
  "Usuario no está en la dirección de entrega",
  "Motorizado llegó antes de tiempo al local",
  "Cambio de cuenta bancaria en el local",
];



// ── Main Component ────────────────────────────────────────────────────────────
export default function AcwPractice() {
  const [allScenarios, setAllScenarios] = useState<AcwScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<AcwScenario | null>(null);
  const [lastScenarioId, setLastScenarioId] = useState<string | null>(null);

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
    const fetch = async () => {
      try {
        const q = query(getPublicCollection('acw_scenarios'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        setAllScenarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcwScenario)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

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
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="p-5 bg-orange-100 dark:bg-orange-900/20 rounded-3xl"><Timer className="text-orange-500" size={48} /></div>
        <h2 className="text-2xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Sin escenarios disponibles</h2>
        <p className="text-m3-secondary/60 dark:text-m3-on-surface-dark/50 max-w-sm">El administrador aún no ha cargado escenarios ACW.</p>
      </div>
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (state === 'lobby') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-[#121212]">
        <div className="max-w-md w-full text-center">
          <div className="relative mx-auto w-28 h-28 flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping" />
            <div className="relative p-6 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <Shuffle size={44} className="text-orange-500" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-1 bg-orange-100 dark:bg-orange-900/30 rounded-lg"><Zap className="text-orange-500" size={14} /></div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Simulador ACW</span>
          </div>
          <h1 className="text-3xl font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-3">Desafío Aleatorio</h1>
          <p className="text-m3-secondary/60 dark:text-m3-on-surface-dark/50 mb-1 text-sm">Recibirás un escenario sorpresa. <strong>Escucha</strong> la llamada y cuando estés listo, presiona <strong>"Colgar"</strong> para que empiece el cronómetro.</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mb-8">🎯 Meta: Tipificar en menos de 30 segundos tras colgar</p>
          <div className="flex items-center justify-center gap-6 mb-8">
            <div><p className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">{allScenarios.length}</p><p className="text-xs text-gray-400">Escenarios</p></div>
            <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
            <div><p className="text-xl font-bold text-orange-500">30s</p><p className="text-xs text-gray-400">Meta ACW</p></div>
            <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
            <div><p className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">ACW</p><p className="text-xs text-gray-400">Modo</p></div>
          </div>
          <button onClick={handleStartChallenge}
            className="w-full py-5 flex items-center justify-center gap-3 bg-orange-500 hover:bg-orange-600 text-white rounded-3xl font-bold text-xl shadow-xl transition-all hover:scale-[1.02] active:scale-100">
            <Play size={26} fill="white" /> ⏱️ Iniciar Desafío Aleatorio
          </button>
        </div>
      </div>
    );
  }

  // ── PRACTICE SCREEN ────────────────────────────────────────────────────────
  const activeScenario = scenario!;

  return (
    <div className="min-h-full flex flex-col bg-gray-50 dark:bg-[#121212]">

      {/* ── Header ── */}
      <div className="px-4 md:px-6 py-3 bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl"><Shuffle size={16} className="text-orange-500" /></div>
          <div>
            <p className="text-xs text-orange-500 font-bold uppercase tracking-wide">Caso Aleatorio</p>
            <h1 className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark leading-tight">{activeScenario.title}</h1>
          </div>
        </div>

        {/* Phase indicator + stopwatch */}
        <div className="flex items-center gap-3">
          {/* Phase badge */}
          <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
            state === 'listening' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : state === 'acw' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
          }`}>
            {state === 'listening' ? '📞 En Llamada' : state === 'acw' ? '⏱ ACW' : '✅ Cerrado'}
          </span>

          {/* Clock */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-mono text-2xl font-bold transition-all duration-200 ${
            state === 'listening' ? 'bg-gray-100 dark:bg-white/5 text-gray-400'
            : state === 'acw'
              ? elapsed > 50000 ? 'bg-red-500 text-white animate-pulse'
                : elapsed > 25000 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-white/5 text-gray-400'
          }`}>
            <Clock size={18} strokeWidth={2.5} />
            {formatTime(state === 'result' ? finalTimeMs : elapsed)}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* LEFT: Video + Datos del Sistema + Colgar Button */}
        <div className="lg:w-[38%] flex flex-col">

          {/* Video */}
          <div className="bg-black flex-1 flex items-center justify-center min-h-[200px]">
            <video ref={videoRef} src={activeScenario.videoUrl} controls
              className="w-full h-full object-contain max-h-[280px] lg:max-h-full" />
          </div>

          {/* 📞 COLGAR LLAMADA button - only visible in 'listening' phase */}
          {state === 'listening' && (
            <button
              onClick={handleHangUp}
              className="mx-4 my-3 flex items-center justify-center gap-3 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-base shadow-lg transition-all hover:scale-[1.02] active:scale-100 animate-pulse"
            >
              <PhoneOff size={22} />
              📞 Colgar Llamada
            </button>
          )}

          {/* ACW started indicator */}
          {state === 'acw' && (
            <div className="mx-4 my-3 flex items-center justify-center gap-2 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded-2xl text-orange-600 dark:text-orange-400 font-bold text-sm">
              <Timer size={16} /> Cronómetro corriendo — Tipifica ahora
            </div>
          )}

          {/* Datos del Sistema */}
          {(activeScenario.contextOrderNumber || activeScenario.contextTicketId) && (
            <div className="bg-[#0f2a52] text-white p-4 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300/70 mb-3">📋 Datos del Sistema</p>
              {activeScenario.contextOrderNumber && (
                <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-[10px] text-blue-300/70 uppercase tracking-wide">Order #</p>
                    <p className="font-mono font-bold text-sm text-white tracking-wider">{activeScenario.contextOrderNumber}</p>
                  </div>
                  <CopyButton value={activeScenario.contextOrderNumber} />
                </div>
              )}
              {activeScenario.contextTicketId && (
                <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-[10px] text-blue-300/70 uppercase tracking-wide">Ticket ID</p>
                    <p className="font-mono font-bold text-sm text-white tracking-wider">{activeScenario.contextTicketId}</p>
                  </div>
                  <CopyButton value={activeScenario.contextTicketId} />
                </div>
              )}
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
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">¡ACW Completado!</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Caso: <span className="font-semibold">{activeScenario.title}</span></p>
              <div className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-black/20 rounded-2xl border border-green-200 dark:border-green-800/30 mb-3 shadow-sm">
                <Clock size={24} className="text-green-600 dark:text-green-400" />
                <span className="font-mono font-bold text-4xl text-green-700 dark:text-green-300">{formatTime(finalTimeMs)}s</span>
              </div>
              {finalTimeMs < 30000
                ? <p className="text-sm font-bold text-green-600 dark:text-green-400 mb-1">🏆 ¡Meta cumplida! Bajo 30 segundos.</p>
                : finalTimeMs < 60000
                ? <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400 mb-1">⚠️ Aceptable, pero puedes mejorar.</p>
                : <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">❌ Más de 60 segundos. ¡Practica más!</p>
              }
              <p className="text-xs text-gray-400 mb-6">{isSavingAttempt ? '💾 Guardando intento...' : '✅ Intento registrado.'}</p>
              <div className="flex gap-3">
                <button onClick={() => { setElapsed(0); setFinalTimeMs(0); setScenario(null); setState('lobby'); }}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent text-m3-secondary dark:text-m3-on-surface-dark rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all">
                  <Shuffle size={15} /> Nuevo Desafío
                </button>
                {allScenarios.length > 1 && (
                  <button onClick={() => { setElapsed(0); setFinalTimeMs(0); handleStartChallenge(); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-m3-primary text-white rounded-xl font-bold text-sm hover:bg-m3-primary/90 shadow-md transition-all">
                    Repetir <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── HeroCare Mockup ── */}
          <div className={state === 'result' ? 'invisible' : ''}>
            {/* Disabled overlay during 'listening' */}
            <div className={`transition-opacity duration-300 ${state === 'listening' ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>

              {/* CRM top bar */}
              <div className="bg-[#1a3a6b] text-white px-4 py-2 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold tracking-wide">HeroCare CRM</span>
                </div>
                <span className="text-xs text-white/50 font-mono">TICKET #{activeScenario.contextTicketId || '—'}</span>
              </div>

              <div className="bg-white dark:bg-[#252525] rounded-b-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/10">

                  {/* ── Left: Toku Widget ── */}
                  <div className="md:col-span-2 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Toku Widget</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 mb-4 text-xs">
                      <p className="text-gray-400 mb-1">Cliente en línea</p>
                      <p className="font-bold text-m3-secondary dark:text-m3-on-surface-dark">Cliente Anónimo</p>
                      <p className="text-gray-400 mt-1">Cola: Soporte General</p>
                    </div>

                    {/* ── NOTA EN TOKU WIDGET ── */}
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Nota en Toku Widget
                    </label>
                    <textarea rows={4} disabled={!fieldsEnabled} value={nota} onChange={e => setNota(e.target.value)}
                      placeholder="Notas del widget Toku..."
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none outline-none focus:ring-2 focus:ring-purple-400/50 disabled:opacity-40 disabled:cursor-not-allowed text-m3-secondary dark:text-m3-on-surface-dark transition-all"
                    />

                    {state === 'listening' && (
                      <p className="text-center text-xs text-blue-500 mt-3 font-semibold">
                        📞 Escuchando llamada — presiona Colgar para tipificar
                      </p>
                    )}
                  </div>

                  {/* ── Right: HeroCare Close Ticket ── */}
                  <div className="md:col-span-3 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Cerrar Ticket — HeroCare</span>
                      </div>
                      {state === 'acw' && (
                        <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                          ACW Activo
                        </span>
                      )}
                    </div>

                    {formError && (
                      <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
                        ⚠️ {formError}
                      </div>
                    )}

                    {/* ── MOTIVO DE CONTACTO PCR3 ── */}
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Motivo de Contacto PCR3 *
                    </label>
                    <div className="relative mb-4">
                      <button type="button" disabled={!fieldsEnabled} onClick={() => setShowReasonDropdown(v => !v)}
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-left flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-all text-m3-secondary dark:text-m3-on-surface-dark disabled:opacity-40 disabled:cursor-not-allowed">
                        <span className={selectedReason ? '' : 'text-gray-400'}>{selectedReason || 'Selecciona un motivo...'}</span>
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                      </button>
                      {showReasonDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                          <div className="p-2 border-b border-gray-100 dark:border-white/5">
                            <input autoFocus type="text" value={reasonSearch} onChange={e => setReasonSearch(e.target.value)} placeholder="Buscar motivo..."
                              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-white/5 rounded-lg outline-none border border-gray-200 dark:border-white/10 text-m3-secondary dark:text-m3-on-surface-dark" />
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {filteredReasons.length === 0
                              ? <p className="text-center text-xs text-gray-400 py-4">Sin resultados</p>
                              : filteredReasons.map((r, i) => (
                                <button key={i} type="button" onClick={() => { setSelectedReason(r); setShowReasonDropdown(false); setReasonSearch(''); }}
                                  className="w-full px-4 py-2.5 text-xs text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 text-m3-secondary dark:text-m3-on-surface-dark transition-colors">
                                  {r}
                                </button>
                              ))

                            }
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── COMENTARIO EN HC ── */}
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Comentario en HC *
                    </label>
                    <textarea rows={3} disabled={!fieldsEnabled} value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Describe el caso brevemente..."
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-40 disabled:cursor-not-allowed text-m3-secondary dark:text-m3-on-surface-dark transition-all mb-4"
                    />

                    {/* Radio Buttons */}
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Finalizar Contacto *</label>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {['Resolver', 'Transferir', 'Escalar'].map(opt => (
                        <label key={opt} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${fieldsEnabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${
                          selectedAction === opt
                            ? 'border-[#1a3a6b] bg-[#1a3a6b]/10 dark:bg-blue-900/30 text-[#1a3a6b] dark:text-blue-300'
                            : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'
                        }`}>
                          <input type="radio" name="finalAction" disabled={!fieldsEnabled} value={opt} checked={selectedAction === opt} onChange={() => setSelectedAction(opt)} className="sr-only" />
                          <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${selectedAction === opt ? 'border-[#1a3a6b] bg-[#1a3a6b]' : 'border-gray-300 dark:border-white/30'}`} />
                          {opt}
                        </label>
                      ))}
                    </div>

                    <button onClick={handleClose} disabled={!fieldsEnabled}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.01] active:scale-100">
                      <CheckCircle2 size={18} /> Cerrar Ticket y Finalizar ACW
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
