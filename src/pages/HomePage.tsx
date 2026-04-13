import { useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { getUserDoc } from '../firebasePaths';
import { ADMIN_UID } from '../constants';
import { getAgentData } from '../api/sheetService';
import type { AgentResponse } from '../api/sheetService';
import { ClipboardList, Lightbulb, Loader2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

// ── LOB badge colours ──────────────────────────────────────────────────────────
const LOB_BADGE: Record<string, string> = {
  phone:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  recupero: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  b2x:      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

// ── Metric formatting ─────────────────────────────────────────────────────────
const NUM_HEADERS = new Set(['AHT Real', 'ATT', 'ACW', 'HS Gestionadas', 'Prod. Tot. Llamadas', 'Prod. Tot. Efectivas', 'AHT', 'FRT']);
const PCT_HEADERS = new Set(['RES', 'PSAT', 'No contestada', 'SAT']);
const INT_HEADERS = new Set(['Efectiva', 'Tot. Llamadas']);

const fmtNum = (v: any): string => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? String(v ?? '—') : n.toFixed(1);
};

const fmtPct = (v: any): string => {
  const s = String(v ?? '');
  if (s.includes('%')) return s;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return s || '—';
  return (n > 0 && n <= 1 ? (n * 100).toFixed(1) : n.toFixed(1)) + '%';
};

const fmtInt = (v: any): string => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? String(v ?? '—') : String(Math.round(n));
};

const formatMetric = (header: string, value: any): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (INT_HEADERS.has(header)) return fmtInt(value);
  if (NUM_HEADERS.has(header)) return fmtNum(value);
  if (PCT_HEADERS.has(header)) return fmtPct(value);
  return String(value);
};

// ── Stat card sub-component ────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/80 dark:bg-[#1E1E1E]/80 border border-m3-surface-variant/40 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <span className="text-[11px] font-bold uppercase tracking-widest text-m3-secondary/60 dark:text-m3-on-surface-dark/50">
        {label}
      </span>
      <span className="text-3xl font-extrabold text-m3-primary dark:text-m3-primary-dark leading-none mt-1">
        {value}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [isGuest,   setIsGuest]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { 
        setIsGuest(true);
        setLoading(false);
        return; 
      }

      if (user.uid === ADMIN_UID) {
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      if (user.email) {
        try {
          const result = await getAgentData(user.email);
          console.log('[HomePage] getAgentData result:', result);
          if (result) {
            setAgentData(result);
            setError('');
            setDoc(getUserDoc(user.uid), { lob: result.lob, email: user.email }, { merge: true }).catch(() => {});
          } else {
            setError('Agente no encontrado en ninguna base de datos.');
          }
        } catch (err: any) {
          console.error('[HomePage] error:', err);
          setError('Error de conexión con la base de datos.');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // ── Admin redirect screen ──────────────────────────────────────────────────
  if (!loading && isAdmin) {
    return (
      <div className="min-h-screen bg-m3-surface dark:bg-m3-surface-dark p-4 pb-24 flex flex-col items-center justify-center">
        <div className="bg-m3-primary/10 dark:bg-m3-primary-dark/20 p-6 rounded-full mb-6">
          <ClipboardList className="text-m3-primary dark:text-m3-primary-dark" size={64} />
        </div>
        <h2 className="text-3xl font-bold text-m3-primary dark:text-m3-primary-dark mb-6">Bienvenido Supervisor</h2>
        <button
          onClick={() => navigate('/admin')}
          className="px-8 py-4 bg-m3-primary dark:bg-m3-primary-dark text-white font-bold text-lg rounded-[28px] shadow-lg hover:shadow-xl transition-all"
        >
          Ir al Panel de Supervisor
        </button>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const agentName  = agentData?.name || 'Agente';
  const lobKey     = (agentData?.lob ?? '').toLowerCase();
  const badgeClass = LOB_BADGE[lobKey] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300';

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-m3-surface-dark p-4 pb-24 transition-colors duration-300">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="mb-6 mt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-m3-primary dark:text-m3-primary-dark">
            Hello, {loading ? '...' : isGuest ? 'Invitado' : agentName.split(' ')[0]}
          </h1>
          {agentData?.lob && !loading && !isGuest && (
            <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${badgeClass}`}>
              Área: {agentData.lob.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-m3-secondary dark:text-m3-on-surface-dark/70 text-sm mt-1">
          {isGuest ? 'Bienvenido al modo de prueba del simulador.' : 'Aquí están tus métricas de hoy.'}
        </p>
      </header>

      {/* ── Guest Banner ──────────────────────────────────────────────────────── */}
      {!loading && isGuest && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 text-purple-800 dark:text-purple-300 px-5 py-4 rounded-2xl mb-6 shadow-sm flex gap-3 items-start">
          <Info className="flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-bold mb-1">Modo Visitante Activo</h3>
            <p className="text-sm">No te has registrado aún. Puedes ver la información y probar los módulos (Quizzes, Simulador ACW) en modo de visitante. Tu actividad quedará registrada temporalmente como invitado.</p>
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-m3-primary dark:text-m3-primary-dark" size={44} />
          <p className="text-sm text-m3-secondary/60 dark:text-m3-on-surface-dark/50">Cargando tus métricas...</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400 px-5 py-4 rounded-2xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* ── Metric cards + suggestion ────────────────────────────────────────── */}
      {!loading && !error && agentData && (
        <>
          {/* Stat card grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {agentData.headers?.map((header, i) => (
              <StatCard
                key={`metric-${i}`}
                label={header}
                value={formatMetric(header, agentData.metrics?.[i])}
              />
            ))}
          </div>

          {/* Supervisor suggestion */}
          <section className="bg-m3-surface-variant/30 dark:bg-m3-surface-variant/10 rounded-[28px] p-8 shadow-sm border border-m3-surface-variant/50 dark:border-transparent hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white dark:bg-m3-primary-dark/20 rounded-full shadow-sm">
                <Lightbulb className="text-yellow-600 dark:text-yellow-300" size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-semibold text-m3-secondary dark:text-m3-on-surface-dark">
                Sugerencia del Supervisor
              </h2>
            </div>
            <div className="bg-white dark:bg-[#1E1E1E]/50 rounded-2xl p-6 border border-white/50 dark:border-white/5">
              <p className="text-m3-secondary dark:text-m3-on-surface-dark/90 text-lg leading-loose font-medium italic">
                "{agentData?.sugerencia || 'No hay sugerencias disponibles por el momento.'}"
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
