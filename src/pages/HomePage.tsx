import { useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { getPublicDoc, getUserDoc, getPublicCollection } from '../firebasePaths';
import { getDoc, setDoc, getDocs } from 'firebase/firestore';
import { ADMIN_UID } from '../constants';
import { getAgentData, getAgentHistory } from '../api/sheetService';
import type { AgentResponse, AgentHistory } from '../api/sheetService';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { usePermissions } from '../context/PermissionsContext';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Clock, Zap, Edit3, Smile, Info, BarChart3, Lightbulb, Loader2, ClipboardList, CheckSquare, TrendingUp, User, ShieldAlert, AlertTriangle } from 'lucide-react';

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
  const [dynamicMetrics, setDynamicMetrics] = useState<Record<string, any> | null | undefined>(undefined);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [isGuest,   setIsGuest]   = useState(false);
  const [historicalKpis, setHistoricalKpis] = useState<string[]>([]);
  const [activeGraphKpi, setActiveGraphKpi] = useState<string>('');
  const [lobConfig, setLobConfig] = useState<any | null>(null);
  const [isUnassigned, setIsUnassigned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

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

      if (user.email) {
        try {
          // 1. Get User LOB from Firestore
          const uSnap = await getDoc(getUserDoc(user.uid));
          const uData = uSnap.data();

          if (user.uid === ADMIN_UID || uData?.isAdmin === true || uData?.role === 'admin') {
            setIsAdmin(true);
          }
          
          let lobId = uData?.lob || uData?.lobId;
          let lobConf = null;
          let activeMetricsObj = null;

          if (lobId) {
             const lSnap = await getDoc(getPublicDoc('lobs', lobId));
             if (lSnap.exists()) {
                 lobConf = lSnap.data();
                 if (lobConf.currentMetricsUrl) {
                     try {
                         const res = await fetch(lobConf.currentMetricsUrl, { redirect: 'follow' });
                         const rawData = await res.json();
                         
                         let finalMetrics: Record<string, any> = {};
                         const userKey = user?.email?.toLowerCase().trim() || '';

                         // FORMATO 1: API de Recupero/Phone (Lista global de agentes en rawData.data)
                         if (rawData.status === 'success' && Array.isArray(rawData.data) && rawData.headers) {
                           const agentObj = rawData.data.find((a: any) => 
                             (a.correo && a.correo.toLowerCase().trim() === userKey) || 
                             (a.email && a.email.toLowerCase().trim() === userKey)
                           );
                           
                           if (agentObj && Array.isArray(agentObj.metrics)) {
                             const headerOffset = rawData.headers[0].toLowerCase() === 'correo' ? 1 : 0;
                             agentObj.metrics.forEach((metricVal: any, index: number) => {
                               const headerName = String(rawData.headers[index + headerOffset] || `Métrica ${index}`);
                               if (headerName.toLowerCase() !== 'correo') finalMetrics[headerName] = metricVal;
                             });
                           }
                         } 
                         // FORMATO 2: API de Recupero/Phone (Respuesta directa individual con rawData.metrics)
                         else if (rawData.status === 'success' && rawData.headers && rawData.metrics) {
                           const headersArray = Array.isArray(rawData.headers) ? rawData.headers : Object.values(rawData.headers);
                           const metricsArray = Array.isArray(rawData.metrics) ? rawData.metrics : Object.values(rawData.metrics);
                           
                           headersArray.forEach((header: any, index: number) => {
                             const headerStr = String(header);
                             if (headerStr.toLowerCase() !== 'correo' && headerStr.toLowerCase() !== 'email') {
                               finalMetrics[headerStr] = metricsArray[index];
                             }
                           });
                         } 
                         // FORMATO 3: API de Claims/B2X (Diccionario directo por correo)
                         else {
                           finalMetrics = rawData[userKey] || {};
                         }

                         // 3. Asignar al estado que dibuja las tarjetas
                         activeMetricsObj = Object.keys(finalMetrics).length > 0 ? finalMetrics : null;

                     } catch(err) {
                         console.error("Error fetching current LOB metrics:", err);
                     }
                 }
             }
          }

          if (!lobId || !activeMetricsObj) {
              setIsScanning(true);
              let foundLobId = null;
              try {
                  const lobsSnap = await getDocs(getPublicCollection('lobs'));
                  const targetEmail = user.email.toLowerCase().trim();
                  for (const docSnap of lobsSnap.docs) {
                     const scanLobConf = docSnap.data();
                     // Evitar volver a buscar en la URL que ya falló
                     if (scanLobConf.currentMetricsUrl && scanLobConf.currentMetricsUrl !== lobConf?.currentMetricsUrl) {
                        try {
                           const res = await fetch(scanLobConf.currentMetricsUrl, { redirect: 'follow' });
                           const rawData = await res.json();
                           
                           let finalMetrics: Record<string, any> = {};
                           const userKey = user?.email?.toLowerCase().trim() || '';

                           // FORMATO 1: API de Recupero/Phone (Lista global de agentes en rawData.data)
                           if (rawData.status === 'success' && Array.isArray(rawData.data) && rawData.headers) {
                             const agentObj = rawData.data.find((a: any) => 
                               (a.correo && a.correo.toLowerCase().trim() === userKey) || 
                               (a.email && a.email.toLowerCase().trim() === userKey)
                             );
                             
                             if (agentObj && Array.isArray(agentObj.metrics)) {
                               const headerOffset = rawData.headers[0].toLowerCase() === 'correo' ? 1 : 0;
                               agentObj.metrics.forEach((metricVal: any, index: number) => {
                                 const headerName = String(rawData.headers[index + headerOffset] || `Métrica ${index}`);
                                 if (headerName.toLowerCase() !== 'correo') finalMetrics[headerName] = metricVal;
                               });
                             }
                           } 
                           // FORMATO 2: API de Recupero/Phone (Respuesta directa individual con rawData.metrics)
                           else if (rawData.status === 'success' && rawData.headers && rawData.metrics) {
                             const headersArray = Array.isArray(rawData.headers) ? rawData.headers : Object.values(rawData.headers);
                             const metricsArray = Array.isArray(rawData.metrics) ? rawData.metrics : Object.values(rawData.metrics);
                             
                             headersArray.forEach((header: any, index: number) => {
                               const headerStr = String(header);
                               if (headerStr.toLowerCase() !== 'correo' && headerStr.toLowerCase() !== 'email') {
                                 finalMetrics[headerStr] = metricsArray[index];
                               }
                             });
                           } 
                           // FORMATO 3: API de Claims/B2X (Diccionario directo por correo)
                           else {
                             finalMetrics = rawData[userKey] || {};
                           }
                           
                           let found = Object.keys(finalMetrics).length > 0 ? finalMetrics : null;
                           
                           if (found) {
                              foundLobId = docSnap.id;
                              await setDoc(getUserDoc(user.uid), { lob: foundLobId, lobId: foundLobId }, { merge: true });
                              lobId = foundLobId;
                              lobConf = scanLobConf;
                              activeMetricsObj = found;
                              break;
                           }
                        } catch(e) {
                           console.error("Scan error for lob", docSnap.id, e);
                        }
                     }
                  }
              } catch(e) {}
              setIsScanning(false);
          }

          if (!lobId) {
             setIsUnassigned(true);
             setLoading(false);
             return;
          }

          setIsUnassigned(false);
          setLobConfig(lobConf || null);
          
          let extractedName = user.email.split('@')[0];
          if (activeMetricsObj) {
              if (activeMetricsObj.nombre || activeMetricsObj.agente || activeMetricsObj.name || activeMetricsObj.Agente) {
                  extractedName = activeMetricsObj.nombre || activeMetricsObj.agente || activeMetricsObj.name || activeMetricsObj.Agente;
              }
              setDynamicMetrics(activeMetricsObj);
          } else {
              setDynamicMetrics(lobConf?.currentMetricsUrl ? {} : null);
          }

          if (lobConf?.historicalMetricsUrl) {
             try {
                const history = await getAgentHistory(user.email, lobConf.historicalMetricsUrl);
                setHistoryData(history);
                const agentHistory = history?.history || {};
                const firstValidDate = Object.keys(agentHistory).find(date => Object.keys(agentHistory[date]).length > 0);
                const detectedKpis = firstValidDate ? Object.keys(agentHistory[firstValidDate]).filter(k => k.toLowerCase() !== 'fecha' && k.toLowerCase() !== 'date') : [];
                setHistoricalKpis(detectedKpis);
                if (detectedKpis.length > 0) setActiveGraphKpi(detectedKpis[0]);
             } catch(e) {}
          }

          setAgentData({ 
            name: extractedName, 
            lob: lobConf?.name || lobId, 
            rawMetrics: {} 
          } as any);
          setError('');

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
  // ── Derived values ─────────────────────────────────────────────────────────
  const agentName  = agentData?.name || 'Agente';
  const lobKey     = (agentData?.lob ?? '').toLowerCase();
  const badgeClass = LOB_BADGE[lobKey] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300';
  
  // Extract Phase 8 fields
  const isAberrante = dynamicMetrics?.aberrante === 'Aberrante';
  const clusterActual = dynamicMetrics?.cluster_actual || dynamicMetrics?.Cluster_Actual;
  const posibleCluster = dynamicMetrics?.posible_cluster || dynamicMetrics?.Posible_Cluster;
  const posibleBaja = dynamicMetrics?.posible_baja || dynamicMetrics?.Posible_Baja;

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 pb-48 transition-colors duration-300">

      <header className="mb-10 mt-2 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className={`text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight transition-all duration-300 ${isAberrante ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''}`}>
              Hola, {loading ? '...' : isGuest ? 'Invitado' : agentName.split(' ')[0]}
            </h1>
            {!loading && !isGuest && dynamicMetrics && (
              isAberrante ? (
                <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse whitespace-nowrap">
                  ⚠️ Estatus: Aberrante
                </span>
              ) : (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                  ✅ Estatus: Estable
                </span>
              )
            )}
          </div>
          
          <div className="flex items-center gap-3 flex-wrap mt-4">
            {agentData?.lob && !loading && !isGuest && (
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                Área: {agentData.lob.toUpperCase()}
              </span>
            )}
          </div>
          
          {/* Tira de Estatus de Carrera (Clusters) */}
          {!loading && !isGuest && (clusterActual || posibleCluster) && (
             <div className="mt-4 flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
               <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Carrera y Perfilamiento:</span>
               {clusterActual && (
                 <span className="bg-white/5 border border-white/10 px-4 py-2 rounded-full text-xs font-bold text-gray-300">
                   Cluster: {clusterActual}
                 </span>
               )}
               {posibleCluster && (
                 <span className="bg-blue-600/10 border border-blue-500/30 px-4 py-2 rounded-full text-xs font-bold text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                   Próximo: {posibleCluster}
                 </span>
               )}
             </div>
          )}

          <p className="text-gray-400 text-sm mt-4 font-medium">
            {isGuest ? 'Bienvenido al modo de prueba del simulador.' : 'Aquí están tus métricas de hoy.'}
          </p>
        </div>

        {isAdmin && !loading && (
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
          >
            <ShieldAlert size={18} />
            <span className="hidden sm:inline">Panel Admin</span>
          </button>
        )}
      </header>

      {/* ── Guest Banner ──────────────────────────────────────────────────────── */}
      {!loading && isGuest && (
        <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl p-6 mb-8 shadow-sm flex gap-4 items-start text-indigo-400">
          <Info className="flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="font-bold mb-1 text-white text-lg">Modo Visitante Activo</h3>
            <p className="text-sm text-gray-400 font-medium">No te has registrado aún. Puedes ver la información y probar los módulos en modo de visitante.</p>
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <Loader2 className="animate-spin text-blue-500" size={48} />
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">
            {isScanning ? 'Sincronizando Área...' : 'Cargando Métricas...'}
          </p>
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



      {/* ── Monthly Impact Section (Source A: Real-time B2X/Main Sheet) ───── */}
      {!loading && !error && agentData && permissions.canViewMetrics && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3 tracking-tight">
            <TrendingUp size={28} className="text-blue-500" />
            Tu Impacto este Mes
          </h2>
          
          {/* Banner de Alerta Máxima (Posible Baja) */}
          {posibleBaja && (
             <div className="bg-gradient-to-r from-red-900/40 via-red-600/20 to-transparent border border-red-500/30 p-4 rounded-2xl flex items-center gap-4 mb-6 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.2)]">
               <div className="bg-red-500/20 p-3 rounded-full shrink-0">
                  <AlertTriangle size={24} className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
               </div>
               <div>
                 <h4 className="text-red-400 font-black uppercase tracking-widest text-sm mb-0.5">Alerta de Desempeño Crítico</h4>
                 <p className="text-red-200/80 text-sm font-medium">{posibleBaja}</p>
               </div>
             </div>
          )}

          {/* Contenedor Lógico de Tarjetas Dinámicas */}
          {dynamicMetrics === undefined ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl">
               <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : dynamicMetrics === null ? (
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl p-8 text-center mb-8">
              <h3 className="text-xl font-bold text-white">Panel en Configuración</h3>
              <p className="text-gray-400 mt-2 font-medium">Las métricas para tu área aún no han sido vinculadas.</p>
            </div>
          ) : Object.keys(dynamicMetrics).length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
              {Object.entries(dynamicMetrics).map(([key, value]) => {
                const lowerKey = key.toLowerCase();
                const excludedKeys = ['agente', 'nombre', 'name', 'correo', 'email', 'lob', 'aberrante', 'cluster_actual', 'posible_cluster', 'posible_baja', 'mensaje_diario'];
                if (excludedKeys.some(k => lowerKey === k || lowerKey === k.replace(/_/g, ''))) return null;

                // Formateo de números: máximo 1 decimal, y si es entero no poner .0
                const formattedValue = typeof value === 'number' 
                  ? (Number.isInteger(value) ? value : value.toFixed(1)) 
                  : (!isNaN(Number(value)) && String(value).includes('.'))
                    ? Number(value).toFixed(1)
                    : value;
                
                return (
                  <div key={key} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col justify-center shadow-lg transition-all duration-500 hover:bg-white/10 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.2)] group">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-hover:text-blue-400 transition-colors">
                       {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-4xl md:text-5xl font-black text-white">{formattedValue}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-yellow-50 text-yellow-800 p-6 rounded-2xl mb-8 border border-yellow-200 text-center dark:bg-yellow-900/10 dark:text-yellow-500 dark:border-yellow-900/30">
              <h3 className="font-bold text-lg mb-1">No hay datos para tu usuario</h3>
              <p>Tu correo <b>{auth.currentUser?.email}</b> no fue encontrado en ningún equipo. Verifica con tu supervisor.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Supervisor Suggestions (Smart Insight) ────────────────────────────────────────── */}
      {!loading && !error && agentData && permissions.canViewMetrics && (
        <div className="mt-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex items-center gap-4 relative overflow-hidden shadow-2xl mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50"></div>
          <div className="bg-white/10 p-3 rounded-full shrink-0 flex items-center justify-center">
            <Lightbulb className="text-yellow-400 animate-pulse" size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Insight del Supervisor</h3>
            <p className="text-gray-300 text-base md:text-lg italic">"{lobConfig?.supervisorSuggestion || 'Sigue dando lo mejor de ti en cada contacto. ¡Excelente turno!'}"</p>
          </div>
        </div>
      )}

      {/* ── Performance Details Module ─────────────────────────────────────── */}
      {!loading && !error && historyData?.history && permissions.canViewMetrics && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Section: Tendencia Mensual */}
          <section className="bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-6 md:p-10 mt-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                  <BarChart3 size={28} className="text-blue-500" />
                  Rendimiento Mensual
                </h3>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mt-2">Evolución completa del mes actual (1 al 31)</p>
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
                
                const dayData = history[dateStr] || {};
                return {
                  day: day,
                  date: `${day}/${month + 1}`,
                  fullDate: dateStr,
                  ...dayData
                };
              });

              // Find last day with data for highlighting
              let lastDayWithData = '';
              monthArray.forEach(row => {
                if (history[row.fullDate]) lastDayWithData = row.fullDate;
              });

              return (
                <>
                  {historicalKpis.length > 0 && (
                    <div className="flex flex-wrap bg-[#111] p-1 rounded-full border border-white/10 mb-8 max-w-fit gap-1">
                      {historicalKpis.map(kpi => (
                        <button
                          key={`btn-${kpi}`}
                          onClick={() => setActiveGraphKpi(kpi)}
                          className={`
                            ${activeGraphKpi === kpi 
                              ? 'px-5 py-2 text-xs font-bold text-white bg-white/10 shadow-md uppercase transition-all rounded-full border border-white/5' 
                              : 'px-5 py-2 text-xs font-bold text-gray-500 uppercase hover:text-white transition-all rounded-full border border-transparent'}
                          `}
                        >
                          {kpi.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="min-h-[350px] w-full mb-12">
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={monthArray}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888'}} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888'}} />
                        <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', fontSize: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }} />
                        
                        {activeGraphKpi && (
                          <Line 
                            type="monotone" 
                            dataKey={activeGraphKpi} 
                            name={activeGraphKpi.toUpperCase().replace(/_/g, ' ')} 
                            stroke="#3b82f6" 
                            strokeWidth={3} 
                            dot={{ r: 4, strokeWidth: 2, fill: '#0A0A0A', stroke: '#3b82f6' }} 
                            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff' }} 
                            connectNulls 
                            animationDuration={500}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly Metrics Table Ultra-Minimalist */}
                  <div className="mt-12">
                    <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-2 px-2">
                      <ClipboardList size={20} className="text-blue-500" /> Detalle Diario del Mes
                    </h4>
                    <div className="overflow-x-auto w-full custom-scrollbar pb-4">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr>
                            <th className="text-[10px] text-gray-500 uppercase tracking-[0.2em] pb-4 font-bold border-b border-white/5 w-16 sticky left-0 bg-[#111] z-20 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">Día</th>
                            {historicalKpis.map(kpi => (
                              <th key={kpi} className="text-[10px] text-gray-500 uppercase tracking-[0.2em] pb-4 font-bold text-right border-b border-white/5 whitespace-nowrap min-w-[100px] px-4">{kpi.replace(/_/g, ' ')}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {monthArray.map((row) => {
                            const isTodayRow = row.fullDate === today;
                            const isLastDataRow = !history[today] && row.fullDate === lastDayWithData;
                            const hasRowData = !!history[row.fullDate];

                            return (
                              <tr 
                                key={row.fullDate}
                                className={`transition-colors duration-200 cursor-default border-b border-white/5
                                  ${isTodayRow ? 'bg-blue-900/10' : ''}
                                  ${isLastDataRow && !isTodayRow ? 'bg-yellow-900/10' : ''}
                                  ${!hasRowData ? 'opacity-40' : 'hover:bg-white/[0.02]'}
                                `}
                              >
                                <td className="text-sm text-gray-300 py-4 font-medium flex items-center gap-3 sticky left-0 bg-[#0A0A0A] z-10 shadow-[4px_0_10px_rgba(0,0,0,0.3)] group-hover:bg-[#111] transition-colors border-b border-white/5">
                                  <span>{row.day}</span>
                                  {(isTodayRow || isLastDataRow) && (
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-black
                                      ${isTodayRow ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                      {isTodayRow ? 'Hoy' : 'Cierre'}
                                    </span>
                                  )}
                                </td>
                                {historicalKpis.map(kpi => {
                                  const val = (row as any)[kpi];
                                  const formattedVal = (val !== undefined && val !== null && val !== '') 
                                      ? (typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : (!isNaN(Number(val)) && String(val).includes('.') ? Number(val).toFixed(1) : val))
                                      : '—';
                                      
                                  return (
                                    <td key={`${row.fullDate}-${kpi}`} className="text-sm text-gray-300 py-4 text-right font-medium whitespace-nowrap min-w-[100px] px-4">
                                      {formattedVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
