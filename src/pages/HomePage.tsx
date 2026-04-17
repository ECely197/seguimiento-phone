import { useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { getPublicDoc, getUserDoc } from '../firebasePaths';
import { getDoc, setDoc } from 'firebase/firestore';
import { ADMIN_UID } from '../constants';
import { getAgentData, getAgentHistory } from '../api/sheetService';
import type { AgentResponse, AgentHistory } from '../api/sheetService';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { usePermissions } from '../context/PermissionsContext';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Clock, Zap, Edit3, Smile, Info, BarChart3, Lightbulb, Loader2, ClipboardList, CheckSquare, TrendingUp, User } from 'lucide-react';

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

function MonthlyImpactCard({ label, value, unit, icon: Icon, colorClass, status }: any) {
  const statusColors: any = {
    green:  'bg-emerald-500',
    yellow: 'bg-amber-500',
    red:    'bg-rose-500',
    gray:   'bg-gray-300'
  };

  return (
    <div className="group relative bg-white dark:bg-[#1E1E1E] rounded-2xl p-6 shadow-sm border border-m3-surface-variant/40 dark:border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* Status Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusColors[status] || statusColors.gray}`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colorClass.bg}`}>
          <Icon size={22} className={colorClass.text} />
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-m3-secondary/50 dark:text-m3-on-surface-dark/40 mb-1">
          {label}
        </h4>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-m3-primary dark:text-m3-primary-dark tracking-tight">
            {value}
          </span>
          <span className="text-[10px] font-bold text-m3-secondary/40 dark:text-m3-on-surface-dark/30 uppercase">
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [historyData, setHistoryData] = useState<AgentHistory | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [isGuest,   setIsGuest]   = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chartMetric, setChartMetric] = useState<'aht' | 'frt' | 'acw' | 'psat'>('aht');
  const [lobConfig, setLobConfig] = useState<any | null>(null);
  const [metricsPending, setMetricsPending] = useState(false);
  const [isUnassigned, setIsUnassigned] = useState(false);

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const navigate = useNavigate();
  const { permissions, loading: permissionsLoading } = usePermissions();

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
          // 1. Get User LOB from Firestore
          const uSnap = await getDoc(getUserDoc(user.uid));
          const uData = uSnap.data();
          
          if (!uData?.lob) {
            setIsUnassigned(true);
            setLoading(false);
            return;
          }
          const lobId = uData.lob;
          setIsUnassigned(false);

          // 2. Get LOB Config (URLs)
          const lSnap = await getDoc(getPublicDoc('lobs', lobId));
          const lData = lSnap.data();
          setLobConfig(lData || null);

          const currentUrl = lData?.currentMetricsUrl;
          const historyUrl = lData?.historicalMetricsUrl;

          if (!currentUrl && !historyUrl) {
            setMetricsPending(true);
            setLoading(false);
            return;
          }

          // 3. Fetch from Dynamic URLs
          const [result, history] = await Promise.all([
            getAgentData(user.email, currentUrl),
            historyUrl ? getAgentHistory(user.email, historyUrl) : Promise.resolve(null)
          ]);

          if (result) {
            setAgentData({ ...result, lob: result.lob === 'dynamic' ? (lData?.name || lobId) : result.lob });
            setHistoryData(history);
            setError('');
          } else {
            setError('Agente no encontrado en el origen de datos de tu área.');
          }
        } catch (err: any) {
          console.error('[HomePage] error:', err);
          setError('Error de conexión con la base de datos operativa.');
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

      {/* ── Unassigned Account Banner (Onboarding) ─────────────────────────── */}
      {!loading && isUnassigned && !isAdmin && (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-m3-surface-variant/10 dark:bg-white/[0.03] rounded-[48px] border-2 border-dashed border-m3-surface-variant/30">
          <div className="p-8 bg-m3-primary/10 rounded-full mb-6">
            <User className="text-m3-primary" size={64} />
          </div>
          <h3 className="text-3xl font-black text-m3-secondary dark:text-white leading-tight">¡Bienvenido al equipo!</h3>
          <p className="text-base text-gray-500 max-w-sm mt-4 leading-relaxed">
            Tu cuenta está **pendiente de asignación de área**. Por favor, avísale a tu supervisor para que active tu perfil y puedas ver tus resultados.
          </p>
          <div className="mt-8 px-6 py-3 bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm italic text-xs text-gray-400">
             Una vez asignado, aquí aparecerán tus métricas de AHT, FRT y PSAT.
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400 px-5 py-4 rounded-2xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* ── Pending Metrics Message ─────────────────────────────────────────── */}
      {!loading && metricsPending && (
        <div className="flex flex-col items-center justify-center py-24 gap-6 px-8 text-center bg-white/50 dark:bg-white/5 rounded-[40px] border border-dashed border-m3-surface-variant/40">
          <div className="p-8 bg-blue-50 dark:bg-blue-900/20 rounded-full animate-pulse">
            <BarChart3 className="text-blue-500" size={64} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-m3-secondary dark:text-white">Panel en Configuración</h3>
            <p className="text-sm text-gray-500 leading-relaxed mt-2 max-w-sm">
                Las métricas para tu área (**{agentData?.lob || 'asignada'}**) aún no han sido sincronizadas.
                <br/><br/>
                Consulta con tu supervisor para vincular el reporte de Google Sheets correspondiente.
            </p>
          </div>
        </div>
      )}

      {/* ── Disabled Module Message ─────────────────────────────────────────── */}

      {/* ── Monthly Impact Section (Source A: Real-time B2X/Main Sheet) ───── */}
      {!loading && !error && agentData && permissions.canViewMetrics && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-5 flex items-center gap-2">
            <TrendingUp size={22} className="text-m3-primary" />
            Tu Impacto este Mes (Acumulado Real)
          </h2>
          
          {(() => {
            const m = agentData.rawMetrics || {};
            const parseStat = (v: any) => {
              const val = parseFloat(String(v || '0').replace(/[^0-9.\-]/g, ''));
              return isNaN(val) ? 0 : (val > 0 && val <= 1 && !String(v).includes('%') ? val * 100 : val);
            };

            const stats = {
              aht:  parseStat(m.aht || m.AHT || m['AHT Real']),
              frt:  parseStat(m.frt || m.FRT),
              acw:  parseStat(m.acw || m.ACW),
              psat: parseStat(m.sat || m.SAT || m.psat || m.PSAT || m.RES),
              kpi5: parseStat(m.kpi5 || m.KPI5)
            };

            return (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MonthlyImpactCard 
                  label="AHT Mes" 
                  value={stats.aht.toFixed(1)} 
                  unit="seg" 
                  icon={Clock} 
                  status={stats.aht < 280 ? 'green' : stats.aht < 320 ? 'yellow' : 'red'}
                  colorClass={{ bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' }} 
                />
                <MonthlyImpactCard 
                  label="FRT Mes" 
                  value={stats.frt.toFixed(1)} 
                  unit="seg" 
                  icon={Zap} 
                  status={stats.frt < 60 ? 'green' : stats.frt < 90 ? 'yellow' : 'red'}
                  colorClass={{ bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' }} 
                />
                <MonthlyImpactCard 
                  label="ACW Mes" 
                  value={stats.acw.toFixed(1)} 
                  unit="seg" 
                  icon={Edit3} 
                  status={stats.acw < 20 ? 'green' : stats.acw < 40 ? 'yellow' : 'red'}
                  colorClass={{ bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' }} 
                />
                <MonthlyImpactCard 
                  label="PSAT Mes" 
                  value={stats.psat.toFixed(1)} 
                  unit="%" 
                  icon={Smile} 
                  status={stats.psat > 85 ? 'green' : stats.psat > 75 ? 'yellow' : 'red'}
                  colorClass={{ bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' }} 
                />
                <MonthlyImpactCard 
                  label="Calidad (KPI 5)" 
                  value={stats.kpi5.toFixed(1)} 
                  unit="%" 
                  icon={CheckSquare} 
                  status={stats.kpi5 > 90 ? 'green' : stats.kpi5 > 80 ? 'yellow' : 'red'}
                  colorClass={{ bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' }} 
                />
              </div>
            );
          })()}
        </section>
      )}

      {/* ── Supervisor Suggestions ────────────────────────────────────────── */}
      {!loading && !error && agentData && (
        <section className="mb-10 p-7 bg-m3-surface-variant/20 dark:bg-white/5 rounded-[32px] border border-m3-surface-variant/30 dark:border-white/10 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full shadow-inner">
              <Lightbulb className="text-yellow-600 dark:text-yellow-300" size={24} />
            </div>
            <h2 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">
              Sugerencia Comercial
            </h2>
          </div>
          <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-m3-surface-variant/20 shadow-sm">
            <p className="text-m3-secondary/80 dark:text-m3-on-surface-dark/90 text-base italic leading-relaxed font-medium">
              "{lobConfig?.supervisorSuggestion || 'Sigue dando lo mejor de ti en cada contacto. ¡Excelente turno!'}"
            </p>
          </div>
        </section>
      )}

      {/* ── Performance Details Module ─────────────────────────────────────── */}
      {!loading && !error && historyData?.history && permissions.canViewMetrics && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Section: Tendencia Mensual */}
          <section className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-6 border border-m3-surface-variant/40 dark:border-white/10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark flex items-center gap-2">
                  <BarChart3 size={24} className="text-m3-primary" />
                  Rendimiento Mensual
                </h3>
                <p className="text-xs text-m3-secondary/60 dark:text-m3-on-surface-dark/50 italic">Evolución completa del mes actual (1 al 31)</p>
              </div>
              
              <div className="flex p-1 bg-m3-surface-variant/20 dark:bg-white/5 rounded-xl w-fit">
                {['aht', 'frt', 'acw', 'psat'].map((m) => (
                  <button 
                    key={m}
                    onClick={() => setChartMetric(m as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase ${chartMetric === m ? 'bg-white dark:bg-m3-primary text-m3-primary dark:text-white shadow-sm' : 'text-m3-secondary/60 dark:text-m3-on-surface-dark/40'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const history = historyData.history;
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              
              const monthArray = Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const dayData = history[dateStr] || { aht: null, frt: null, acw: null, psat: null, kpi5: null };
                return {
                  day: day,
                  date: `${day}/${month + 1}`,
                  fullDate: dateStr,
                  aht: dayData.aht,
                  frt: dayData.frt,
                  acw: dayData.acw,
                  psat: dayData.psat,
                  kpi5: (dayData as any).kpi5
                };
              });

              // Find last day with data for highlighting
              let lastDayWithData = '';
              monthArray.forEach(row => {
                if (history[row.fullDate]) lastDayWithData = row.fullDate;
              });

              return (
                <>
                  <div className="h-72 w-full mb-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthArray}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888'}} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888'}} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                        <Line 
                          type="monotone" 
                          dataKey={chartMetric} 
                          stroke={chartMetric === 'aht' ? '#3B82F6' : chartMetric === 'frt' ? '#EAB308' : chartMetric === 'acw' ? '#A855F7' : '#10B981'} 
                          strokeWidth={3} 
                          dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} 
                          activeDot={{ r: 5 }} 
                          connectNulls={true}
                          animationDuration={1000} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly Metrics Table */}
                  <div className="mt-8">
                    <h4 className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-4 flex items-center gap-2 px-1">
                      <ClipboardList size={16} /> Detalle Diario del Mes
                    </h4>
                    <div className="rounded-2xl border border-m3-surface-variant/30 bg-m3-surface/50 dark:bg-black/10 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-m3-surface-variant/20 dark:bg-white/5 text-gray-500 font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Día</th>
                              <th className="px-4 py-3 text-center">AHT</th>
                              <th className="px-4 py-3 text-center">FRT</th>
                              <th className="px-4 py-3 text-center">ACW</th>
                              <th className="px-4 py-3 text-center">PSAT</th>
                              <th className="px-4 py-3 text-center">KPI 5</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
                            {monthArray.map((row) => {
                              const isTodayRow = row.fullDate === today;
                              const isLastDataRow = !history[today] && row.fullDate === lastDayWithData;
                              const hasRowData = !!history[row.fullDate];

                              return (
                                <tr 
                                  key={row.fullDate}
                                  className={`transition-colors 
                                    ${isTodayRow ? 'bg-m3-primary/10 dark:bg-m3-primary/20 font-bold' : ''}
                                    ${isLastDataRow ? 'bg-yellow-50 dark:bg-yellow-900/10 ring-1 ring-yellow-400/20' : ''}
                                    ${!hasRowData ? 'opacity-30' : 'hover:bg-m3-surface-variant/10 dark:hover:bg-white/5'}
                                  `}
                                >
                                  <td className="px-4 py-2.5 font-medium">
                                    <div className="flex items-center gap-2">
                                      {row.day}
                                      {(isTodayRow || isLastDataRow) && (
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase leading-none font-black
                                          ${isTodayRow ? 'bg-m3-primary text-white' : 'bg-yellow-500 text-white'}`}>
                                          {isTodayRow ? 'Hoy' : 'Cierre'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">{row.aht ? fmtNum(row.aht) : '—'}</td>
                                  <td className="px-4 py-2.5 text-center">{row.frt ? fmtNum(row.frt) : '—'}</td>
                                  <td className="px-4 py-2.5 text-center">{row.acw ? fmtNum(row.acw) : '—'}</td>
                                  <td className="px-4 py-2.5 text-center">{row.psat ? fmtPct(row.psat) : '—'}</td>
                                  <td className="px-4 py-2.5 text-center">{row.kpi5 ? fmtPct(row.kpi5) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}
    </div>
  );
}
