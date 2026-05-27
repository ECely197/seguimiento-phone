import { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, query, where, deleteDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, appId as firebaseAppId } from '../firebaseConfig';
// @ts-ignore
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseAppId;
import { getPublicCollection, getPublicDoc, getUserDoc, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  ChevronRight, Search, X, Loader2, TrendingUp,
  CheckCircle, XCircle, RefreshCw, User, Edit3, Save, Clock, Building2, Play, Video as VideoIcon, MessageCircle,
  Film, CheckSquare, Activity
} from 'lucide-react';
import { updateAgentSuggestion } from '../api/sheetService';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent { [key: string]: any; }
interface AgentGroup { name: string; agents: Agent[]; columns: string[]; }
interface LobConfig { id: string; name: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const deriveColumns = (rows: Agent[]): string[] => {
  const keys = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
  return Array.from(keys);
};

const getEmail = (a: Agent) => a.correo ?? a.Correo ?? a.email ?? a.Email ?? '';
const getName  = (a: Agent) => a.agente ?? a.Agente ?? a.nombre ?? a.name ?? '';
const initials = (a: Agent) => getName(a).substring(0, 2).toUpperCase() || '??';

const getMessageLink = (a: Agent): string | null => {
  const link = a.mensaje_diario ?? a.Mensaje_Diario ?? a.am ?? a.AM;
  if (typeof link === 'string' && (link.includes('http') || link.includes('wa.me'))) {
    return link.trim();
  }
  return null;
};

const NUM_COLS = new Set(['total_casos', 'AHT Real', 'ATT', 'ACW', 'HS Gestionadas', 'Prod. Tot. Llamadas', 'Prod. Tot. Efectivas', 'AHT', 'FRT', 'aht', 'frt', 'acw', 'sat', 'hs', 'prod']);
const PCT_COLS = new Set(['RES', 'PSAT', 'No contestada', 'SAT', 'sat', 'psat']);
const INT_COLS = new Set(['Efectiva', 'Tot. Llamadas', 'total_casos']);

const fmtNum = (v: any): string => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? (v ?? '—') : n.toFixed(1);
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

const fmtCell = (col: string, v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (INT_COLS.has(col) || INT_COLS.has(col.toLowerCase())) return fmtInt(v);
  if (NUM_COLS.has(col) || NUM_COLS.has(col.toLowerCase())) return fmtNum(v);
  if (PCT_COLS.has(col) || PCT_COLS.has(col.toLowerCase())) return fmtPct(v);
  return String(v);
};

const EMAIL_COLS = new Set(['correo', 'email', 'Correo', 'Email']);

// Formateador Inteligente de Celdas (Fix Decimales)
const formatCellValue = (key: string, value: any) => {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'string' && value.toUpperCase().startsWith('Q')) return value; // Para Q-AHT, Q-PROD

  // Manejo de valores string que en realidad son flotantes
  const numValue = typeof value === 'string' && !isNaN(parseFloat(value)) && value.includes('.') ? parseFloat(value) : value;

  if (typeof numValue === 'number') {
    const keyLower = key.toLowerCase();
    const isPercentageKey = keyLower.includes('psat') || keyLower.includes('res') || keyLower.includes('sat') || keyLower.includes('%');
    const isDecimalFraction = numValue > 0 && numValue <= 1 && !Number.isInteger(numValue);

    if (isPercentageKey || isDecimalFraction) {
      return (numValue * 100).toFixed(1) + '%';
    }
    return Number.isInteger(numValue) ? numValue : numValue.toFixed(1);
  }
  
  return value.toString();
};

const formatTimestamp = (ts: any): string => {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return '—';
  
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

// ── Shared table sub-component ─────────────────────────────────────────────────
function AgentTable({
  title, badgeClass, count, agents, columns, selected, onSelect,
}: {
  title: string; badgeClass: string; count: number;
  agents: Agent[]; columns: string[];
  selected: Agent | null; onSelect: (a: Agent) => void;
}) {
  const metricCols = columns.filter(c => {
    const cl = c.toLowerCase();
    return !EMAIL_COLS.has(c) && 
           cl !== 'agente' && cl !== 'nombre' && cl !== 'name' &&
           cl !== 'mensaje_diario' && cl !== 'am';
  });

  return (
    <div className="mb-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm ${badgeClass}`}>
          {title}
        </span>
        <span className="text-xs font-bold text-gray-400">{count} agente{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-3xl border border-white/5 bg-[#0A0A0A]/80 backdrop-blur-2xl shadow-lg mt-4 w-full overflow-x-auto custom-scrollbar pb-4 max-h-[420px] p-2">
        <table className="w-full table-fixed text-left border-collapse min-w-[800px]">
          <colgroup>
            <col className="w-[120px] sm:w-[180px] md:w-[250px]" />
            {metricCols.map(col => <col key={col} className="w-[90px]" />)}
            <col className="w-[40px]" />
          </colgroup>
          <thead className="bg-[#111]/80 sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
            <tr>
              <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-left sticky left-0 bg-[#111] z-20 min-w-[200px] shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                Agente / Correo
              </th>
              {metricCols.map(col => (
                <th key={col} className="px-2 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right whitespace-nowrap min-w-[80px]">
                  {col.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}
              <th className="px-4 py-4 w-8">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={metricCols.length + 2} className="p-12 text-center text-gray-500 text-xs italic">
                  No se encontraron resultados en esta categoría.
                </td>
              </tr>
            ) : agents.map((agent, idx) => (
              <tr
                key={getEmail(agent) || idx}
                onClick={() => onSelect(agent)}
                className={`group hover:bg-white/5 transition-all cursor-pointer
                  ${selected && getEmail(selected) === getEmail(agent) ? 'bg-white/10' : ''}`}
              >
                <td className="px-4 py-4 sticky left-0 bg-[#0A0A0A] z-10 min-w-[200px] shadow-[4px_0_10px_rgba(0,0,0,0.3)] group-hover:bg-[#111] transition-colors">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-8 h-8 rounded-xl bg-blue-900/30 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-xs flex-shrink-0 transition-transform group-hover:scale-110">
                      {initials(agent)}
                    </div>
                    <div className="min-w-0 overflow-hidden flex-1 flex flex-col justify-center">
                        <p className="text-xs font-bold text-gray-200 leading-tight truncate block" title={getName(agent)}>{getName(agent)}</p>
                        <p className="text-[10px] text-gray-500 font-medium truncate block max-w-[150px]" title={getEmail(agent)}>{getEmail(agent)}</p>
                    </div>
                    {getMessageLink(agent) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(getMessageLink(agent)!, '_blank', 'noopener,noreferrer');
                        }}
                        className="p-2 shrink-0 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-full transition-all border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        title="Enviar Mensaje Diario (WhatsApp)"
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                </td>
                {metricCols.map(col => (
                  <td key={col} className="px-2 py-4 text-right text-xs font-bold text-gray-300 min-w-[80px] whitespace-nowrap">
                    {formatCellValue(col, agent[col])}
                  </td>
                ))}
                <td className="px-4 py-4 text-right">
                  <ChevronRight size={14} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminAgents({ selectedLob: globalLobFilter, onModalStateChange }: { selectedLob?: string, onModalStateChange?: (isOpen: boolean) => void }) {
  // Data
  const [dynamicGroups, setDynamicGroups] = useState<Record<string, AgentGroup>>({});
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);

  // UI
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selected,      setSelected]      = useState<Agent | null>(null);
  const [selectedSrc,   setSelectedSrc]   = useState<string>('');
  const [suggestion,    setSuggestion]    = useState('');
  const [agentLob,      setAgentLob]      = useState('phone');
  const [lobs,          setLobs]          = useState<LobConfig[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [activeTab,     setActiveTab]     = useState<'gestion' | 'academy' | 'quizzes' | 'acw'>('gestion');

  // Quiz & Activity
  const [agentResults,   setAgentResults]   = useState<any[]>([]);
  const [agentAcw,       setAgentAcw]       = useState<any[]>([]);
  const [agentAcademy,   setAgentAcademy]   = useState<any[]>([]);
  const [quizMap,        setQuizMap]        = useState<Record<string, string>>({});
  const [resultsLoading, setResultsLoading] = useState(false);

  const [allProcesses, setAllProcesses] = useState<any[]>([]);
  const [viewedExplanations, setViewedExplanations] = useState<Record<string, any>>({});
  const [allQuizzes, setAllQuizzes] = useState<any[]>([]);

  useEffect(() => { loadAll(); fetchQuizzes(); }, []);

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selected]);

  useEffect(() => {
    onModalStateChange?.(!!selected);
    if (selected) {
      const email = getEmail(selected);
      if (email) {
        fetchAgentResults(email);
        fetchAgentRecord(email);
      }
    }
  }, [selected, onModalStateChange]);

  const fetchAgentRecord = async (email: string) => {
    try {
      const usersRef = collection(db, 'artifacts', appId, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setAgentLob(snap.docs[0].data().lob || 'phone');
      } else {
        setAgentLob('phone');
      }
    } catch (err) { console.error('[AdminAgents] fetchAgentRecord:', err); }
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const snap = await getDocs(getPublicCollection('lobs'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLobs(list.map((l: any) => ({ id: l.id, name: l.name })));

      const newGroups: Record<string, AgentGroup> = {};

      await Promise.all(list.map(async (lob: any) => {
          if (lob.currentMetricsUrl) {
              try {
                  const res = await fetch(lob.currentMetricsUrl, { redirect: 'follow' });
                  const apiResponse = await res.json();
                  let agentsArr: any[] = [];

                  if (Array.isArray(apiResponse.data)) {
                    // Formato Array (Ej. Recupero)
                    agentsArr = apiResponse.data.map((agent: any) => {
                      let row: Record<string, any> = { correo: agent.correo || agent.email };
                      
                      // Extraer lógicas de columnas para Recupero con Headers
                      if (apiResponse.headers && Array.isArray(agent.metrics)) {
                        const headerOffset = apiResponse.headers[0]?.toLowerCase() === 'correo' ? 1 : 0;
                        agent.metrics.forEach((val: any, idx: number) => {
                          const headerName = apiResponse.headers[idx + headerOffset];
                          if (headerName) row[headerName] = val;
                        });
                      } 
                      // Extraer lógicas directas si viene en un objeto metrics
                      else if (agent.metrics && typeof agent.metrics === 'object') {
                        row = { ...row, ...agent.metrics };
                      } 
                      // Fallback si es un array plano
                      else {
                        row = { ...row, ...agent };
                      }
                      return row;
                    });
                  } else if (typeof apiResponse === 'object' && apiResponse !== null && !apiResponse.status) {
                    // Formato Diccionario (Ej. B2X / Claims)
                    agentsArr = Object.entries(apiResponse).map(([email, metrics]) => {
                       if (typeof metrics === 'object' && metrics !== null) {
                          return { correo: email, ...(metrics as Record<string, any>) };
                       }
                       return { correo: email, valor: metrics };
                    });
                  } else if (Array.isArray(apiResponse)) {
                    agentsArr = apiResponse;
                  }

                  newGroups[lob.id] = { 
                      name: lob.name || lob.id,
                      agents: agentsArr, 
                      columns: deriveColumns(agentsArr) 
                  };
              } catch (e) {
                  console.error(`Error fetching metrics for LOB ${lob.id}:`, e);
                  newGroups[lob.id] = { name: lob.name || lob.id, agents: [], columns: [] };
              }
          }
      }));

      setDynamicGroups(newGroups);
    } catch (err) {
      console.error('[AdminAgents] loadAll:', err);
      setLoadError('No se pudieron cargar los datos de las planillas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizzes = async () => {
    try {
      const snap = await getDocs(getPublicCollection('quizzes'));
      const map: Record<string, string> = {};
      snap.forEach(d => { map[d.id] = d.data().situation || d.data().title || 'Quiz'; });
      setQuizMap(map);
    } catch (err) { console.error('[AdminAgents] fetchQuizzes:', err); }
  };

  const fetchAgentResults = async (email: string) => {
    setResultsLoading(true);
    try {
      // 1. Get agent's uid
      const usersRef = collection(db, 'artifacts', appId, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      const agentId = snap.empty ? null : snap.docs[0].id;

      let resultsList: any[] = [];
      let acwList: any[] = [];
      let viewedMap: Record<string, any> = {};

      if (agentId) {
        // Fetch quiz_results / resultados_quizzes
        const [snapRes1, snapRes2, snapAcw, snapViewed] = await Promise.allSettled([
          getDocs(collection(db, 'artifacts', appId, 'users', agentId, 'resultados_quizzes')),
          getDocs(collection(db, 'artifacts', appId, 'users', agentId, 'quiz_results')),
          getDocs(collection(db, 'artifacts', appId, 'users', agentId, 'acw_attempts')),
          getDocs(collection(db, 'artifacts', appId, 'users', agentId, 'viewed_explanations'))
        ]);

        if (snapRes1.status === 'fulfilled') {
          snapRes1.value.forEach(d => resultsList.push({ id: d.id, ...d.data() }));
        }
        if (snapRes2.status === 'fulfilled') {
          snapRes2.value.forEach(d => {
            if (!resultsList.some(r => r.id === d.id)) {
              resultsList.push({ id: d.id, ...d.data() });
            }
          });
        }
        if (snapAcw.status === 'fulfilled') {
          snapAcw.value.forEach(d => acwList.push({ id: d.id, ...d.data() }));
        }
        if (snapViewed.status === 'fulfilled') {
          snapViewed.value.forEach(d => {
            viewedMap[d.id] = d.data();
          });
        }
      } else {
        // Fallback for email matching in case user doc doesn't exist
        const [allQ, allAcw, allAcad] = await Promise.all([
          fetchAllUsersSubcollection('resultados_quizzes'),
          fetchAllUsersSubcollection('acw_attempts'),
          fetchAllUsersSubcollection('process_views')
        ]);
        resultsList = allQ.filter((r: any) => r.agentEmail === email);
        acwList = allAcw.filter((r: any) => r.userEmail === email);
      }

      setAgentResults(resultsList);
      setAgentAcw(acwList);
      setViewedExplanations(viewedMap);

      // Fetch all public processes and quizzes for contrast
      const { getDocsWithFallback } = await import("../firebasePaths");
      const [snapProc, snapQuizzes] = await Promise.allSettled([
        getDocsWithFallback("processes"),
        getDocsWithFallback("quizzes")
      ]);

      if (snapProc.status === 'fulfilled') {
        const procList = snapProc.value.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllProcesses(procList);
      }
      if (snapQuizzes.status === 'fulfilled') {
        const qList = snapQuizzes.value.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllQuizzes(qList);
      }
    } catch (err) { 
      console.error('[AdminAgents] fetchAgentResults:', err); 
    } finally { 
      setResultsLoading(false); 
    }
  };

  const deleteResult = async (r: any) => {
    if (!confirm('¿Reiniciar este intento?')) return;
    try {
      await deleteDoc(doc(db, r.path));
      setAgentResults(prev => prev.filter(res => res.id !== r.id));
    } catch (err) { console.error('[AdminAgents] deleteResult:', err); }
  };

  const handleUpdateReviewStatus = async (r: any, newStatus: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, r.path), {
        reviewStatus: newStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid
      });
      setAgentResults(prev => prev.map(res => res.id === r.id ? { ...res, reviewStatus: newStatus } : res));
    } catch (err) {
      console.error('Error updating reviewStatus:', err);
      alert('Hubo un error al guardar la revisión.');
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true); setSaveError(null);
    try {
      await updateAgentSuggestion(getEmail(selected), suggestion);
      
      const email = getEmail(selected);
      const usersRef = collection(db, 'artifacts', appId, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      
      const targetUid = snap.empty ? email : snap.docs[0].id;
      const userRef = doc(db, 'artifacts', appId, 'users', targetUid);
      
      // Aseguramos que se use setDoc con merge para no arrojar "not found"
      await setDoc(userRef, {
        lob: agentLob,
        lobId: agentLob,
        email: email,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const patch = { ...dynamicGroups };
      if (patch[selectedSrc]) {
          patch[selectedSrc] = {
              ...patch[selectedSrc],
              agents: patch[selectedSrc].agents.map(a =>
                  getEmail(a) === getEmail(selected) ? { ...a, sugerencia: suggestion } : a
              )
          };
      }
      setDynamicGroups(patch);
      setSelected(null);
      alert('Cambios guardados correctamente.');
    } catch (err) { 
      console.error('[AdminAgents] handleSave:', err);
      setSaveError('Error al guardar los cambios.'); 
    }
    finally { setSaving(false); }
  };

  // Filter Logic: Selected Search Term + Global LOB Filter
  const t = searchTerm.toLowerCase();
  const applyFilters = (agents: Agent[]) => {
    return !t ? agents : agents.filter(a =>
      getName(a).toLowerCase().includes(t) || getEmail(a).toLowerCase().includes(t)
    );
  };

  const accuracy = () => {
    if (!agentResults.length) return 0;
    return Math.round((agentResults.filter(r => r.isCorrect).length / agentResults.length) * 100);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <Loader2 className="animate-spin text-m3-primary" size={48} />
      <p className="text-sm font-bold text-m3-secondary/50 uppercase tracking-widest">Sincronizando Directorio...</p>
    </div>
  );

  return (
    <div className="flex h-full gap-6 relative">

      {/* ── Tables area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col pr-1 animate-in fade-in duration-500">

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/5 p-6 rounded-3xl shadow-lg gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text" placeholder="Buscar agente por nombre o correo..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#111] text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder:text-gray-600"
            />
          </div>
          <button onClick={loadAll} className="flex items-center justify-center w-full md:w-auto gap-2 px-6 py-3 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white rounded-2xl font-bold text-sm transition-all border border-white/10">
            <RefreshCw size={18} /> Actualizar Datos
          </button>
        </div>

        {loadError && (
          <div className="mb-6 px-6 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-3">
            <XCircle size={20} /> {loadError}
          </div>
        )}

        {/* Dynamic Table Rendering based on filters */}
        {Object.entries(dynamicGroups).map(([lobId, group], index) => {
            if (globalLobFilter && globalLobFilter !== 'all' && globalLobFilter !== lobId) {
                return null;
            }

            const filteredAgents = applyFilters(group.agents);
            const colors = [
                'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
                'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
                'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
                'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
                'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300'
            ];
            const badgeColor = colors[index % colors.length];

            return (
                <AgentTable
                    key={lobId}
                    title={group.name}
                    badgeClass={badgeColor}
                    count={filteredAgents.length}
                    agents={filteredAgents}
                    columns={group.columns}
                    selected={selected}
                    onSelect={a => { setSelected(a); setSelectedSrc(lobId); }}
                />
            );
        })}

        {/* Empty States */}
        {globalLobFilter && globalLobFilter !== 'all' && !dynamicGroups[globalLobFilter] && (
           <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-white/10">
              <Building2 size={48} className="text-gray-300 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin datos de planilla para {lobs.find(l=>l.id === globalLobFilter)?.name || globalLobFilter}</p>
              <p className="text-xs text-gray-500 mt-2 max-w-xs">Esta área aún no tiene una fuente de datos (Google Sheet) vinculada al directorio.</p>
           </div>
        )}
        
        {Object.keys(dynamicGroups).length === 0 && !loading && (
           <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-white/10">
              <Building2 size={48} className="text-gray-300 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin áreas configuradas</p>
              <p className="text-xs text-gray-500 mt-2 max-w-xs">Aún no se han añadido áreas con URLs de métricas válidas.</p>
           </div>
        )}
      </div>

      {/* ── Perfil 360° Modal (Floating Island) ────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 animate-in fade-in">
          <div className="bg-[#0A0A0A]/95 border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.8)] w-full max-w-[620px] h-[80vh] rounded-[2.5rem] flex flex-col overflow-hidden backdrop-blur-3xl animate-in fade-in-50 zoom-in-95 duration-200">
            
            {/* Header Wrapper (Static) */}
            <div className="p-6 pb-4 border-b border-white/5 flex flex-col shrink-0 relative">
              <button 
                onClick={() => setSelected(null)} 
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors duration-200 cursor-pointer z-50"
              >
                <X size={16} />
              </button>
              
              {/* Avatar y Datos Centrados */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600/15 border border-blue-500/30 text-blue-400 text-xl font-black flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)] mx-auto mb-3">
                  {initials(selected)}
                </div>
                <h2 className="text-xl font-black text-white leading-tight tracking-tight">{getName(selected) || 'Desconocido'}</h2>
                <p className="text-xs text-gray-400 mt-1">{getEmail(selected)}</p>
                
                <div className="mt-3 flex justify-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20">
                    {dynamicGroups[selectedSrc]?.name || selectedSrc.toUpperCase() || 'Sin Área'}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-green-600/10 text-green-400 border border-green-500/20">
                    Score: {accuracy()}%
                  </span>
                </div>
              </div>

              {/* Selector Segmentado de Tabs */}
              <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl mx-auto mt-4 w-full max-w-[480px] justify-between">
                {[
                  { id: 'gestion', label: 'Dashboard' },
                  { id: 'academy', label: 'Formación' },
                  { id: 'quizzes', label: 'Quizzes' },
                  { id: 'acw', label: 'ACW Lab' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl transition-all duration-300 cursor-pointer ${
                      activeTab === tab.id 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-102' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Content Area (Independent Internal Scroll) */}
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
               {activeTab === 'gestion' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 group">
                        <label className="block text-[10px] font-black text-gray-500 mb-3 uppercase tracking-wider group-hover:text-blue-500 transition-colors">
                          Sincronización Operativa (LOB)
                        </label>
                        <select 
                          value={agentLob}
                          onChange={e => setAgentLob(e.target.value)}
                          className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-black/40 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer backdrop-blur-md appearance-none"
                        >
                          {lobs.length === 0 ? <option value="">Cargando áreas...</option> : <><option value="">Selecciona un Área...</option>{lobs.map(lob => <option key={lob.id} value={lob.id}>{lob.name}</option>)}</>}
                        </select>
                     </div>
                     
                     <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 relative overflow-hidden group">
                        <label className="block text-[10px] font-black text-gray-500 mb-3 uppercase tracking-wider group-hover:text-purple-400 transition-colors">
                          Estrategia de Mejora (Feedback)
                        </label>
                        <textarea
                          value={suggestion} onChange={e => setSuggestion(e.target.value)}
                          className="w-full h-32 p-4 rounded-xl border border-white/5 bg-black/40 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm transition-all placeholder:text-gray-700 font-medium"
                          placeholder="Define los puntos de dolor y oportunidades comerciales detectadas..."
                        />
                        {saveError && <p className="mt-3 text-xs text-red-500 font-black text-center animate-pulse">⚠️ {saveError}</p>}
                     </div>
                  </div>
               )}

               {activeTab === 'academy' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Progresión de Aprendizaje</h3>
                     {(() => {
                        const lobProcesses = allProcesses.filter(p => p.lobId === agentLob || p.lobId === 'phone');
                        if (lobProcesses.length === 0) {
                           return (
                              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-white/5 bg-white/[0.01] text-center min-h-[220px] transition-all">
                                  <Film size={36} className="text-gray-400 opacity-25 mb-4 animate-[pulse_3s_infinite]" />
                                  <p className="text-xs text-gray-400">Sin capacitación completada</p>
                              </div>
                           );
                        }
                        return lobProcesses.map((proc) => {
                           const viewed = viewedExplanations[proc.id];
                           return (
                             <div key={proc.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm group">
                                 <div className="flex gap-3 items-center">
                                     <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                                         <VideoIcon size={16} />
                                     </div>
                                     <div>
                                         <p className="text-sm font-bold text-white leading-tight">{proc.title || 'Material de Formación'}</p>
                                         <p className="text-[9px] text-gray-500 mt-1 font-semibold uppercase tracking-wider">{proc.category || 'General'}</p>
                                     </div>
                                 </div>
                                 <div>
                                     {viewed ? (
                                         <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap">
                                             ✓ Visto el {formatTimestamp(viewed.timestamp || viewed.viewedAt)}
                                         </span>
                                     ) : (
                                         <span className="bg-white/5 border border-white/10 text-gray-400 px-3 py-1 rounded-full text-[11px] font-bold">
                                             Pendiente
                                         </span>
                                     )}
                                 </div>
                             </div>
                           );
                        });
                     })()}
                  </div>
               )}

               {activeTab === 'quizzes' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Logros y Evaluaciones</h3>
                     {resultsLoading ? <Loader2 className="animate-spin mx-auto text-blue-500 my-10" /> : (() => {
                        const lobQuizzes = allQuizzes.filter(q => q.lobId === agentLob || q.lobId === 'phone');
                        if (lobQuizzes.length === 0) {
                           return (
                              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-white/5 bg-white/[0.01] text-center min-h-[220px] transition-all">
                                  <CheckSquare size={36} className="text-gray-400 opacity-25 mb-4 animate-[pulse_3s_infinite]" />
                                  <p className="text-xs text-gray-400">Aún no se registran evaluaciones</p>
                              </div>
                           );
                        }
                        return lobQuizzes.map((quiz) => {
                           const res = agentResults.find(r => r.quizId === quiz.id);
                           return (
                             <div key={quiz.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4 relative overflow-hidden group hover:bg-white/5 transition-all shadow-inner">
                                 <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${res ? (res.isCorrect ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-500'}`} />
                                 <div className="flex justify-between items-start pl-2">
                                     <div>
                                         <h4 className="text-md font-black text-white">{quiz.situation || quiz.title || 'Evaluación'}</h4>
                                         {res ? (
                                             <span className="text-[9px] text-gray-500 uppercase tracking-wider font-black mt-1.5 inline-block bg-white/5 px-2.5 py-0.5 rounded-full">
                                                 Finalizado: {formatTimestamp(res.timestamp || res.completedAt)}
                                             </span>
                                         ) : (
                                             <span className="text-[9px] text-gray-400 uppercase tracking-wider font-black mt-1.5 inline-block bg-white/5 px-2.5 py-0.5 rounded-full">
                                                 Asignado
                                             </span>
                                         )}
                                     </div>
                                     <div className="text-right">
                                         {res ? (
                                             <span className={`text-xs font-black ${res.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                 Score: {res.score !== undefined ? `${res.score}%` : (res.isCorrect ? '100%' : '0%')}
                                             </span>
                                         ) : (
                                             <span className="bg-white/5 border border-white/10 text-gray-400 px-3 py-1 rounded-full text-[11px] font-bold">
                                                 Por Realizar
                                             </span>
                                         )}
                                     </div>
                                 </div>
                                 
                                 {res && (res.audioUrl || res.audio) && (
                                     <div className="w-full pl-2">
                                         <button 
                                             onClick={() => window.open(res.audioUrl || res.audio, '_blank')} 
                                             className="w-full py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                         >
                                             ▶️ Escuchar Grabación de Audio
                                         </button>
                                     </div>
                                 )}
                             </div>
                           );
                        });
                     })()}
                  </div>
               )}

               {activeTab === 'acw' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Métricas de Velocidad (ACW Lab)</h3>
                     {agentAcw.length === 0 ? (
                         <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-white/5 bg-white/[0.01] text-center min-h-[220px] transition-all">
                             <Activity size={36} className="text-gray-400 opacity-25 mb-4 animate-[pulse_3s_infinite]" />
                             <p className="text-xs text-gray-400">Aún no se registran métricas de velocidad</p>
                         </div>
                     ) : (
                         <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                             <table className="w-full text-left border-collapse text-xs">
                                 <thead>
                                     <tr className="border-b border-white/5 bg-white/5">
                                         <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Escenario</th>
                                         <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Tiempo</th>
                                         <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Tipificación</th>
                                         <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Fecha</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-white/5">
                                     {agentAcw
                                       .sort((a, b) => (b.timestamp?.toDate?.()?.getTime() || 0) - (a.timestamp?.toDate?.()?.getTime() || 0))
                                       .map((acw, idx) => (
                                         <tr key={acw.id || idx} className="hover:bg-white/5 transition-colors">
                                             <td className="p-3 font-bold text-white truncate max-w-[150px]" title={acw.scenarioTitle}>{acw.scenarioTitle || 'Simulación'}</td>
                                             <td className={`p-3 font-black text-right ${acw.timeSpent <= 30 ? 'text-green-400' : 'text-red-400'}`}>{acw.timeSpent}s</td>
                                             <td className="p-3 text-gray-300 font-medium truncate max-w-[150px]" title={acw.comments || acw.inputs?.comment}>{acw.comments || acw.inputs?.comment || 'Evidencia vacía'}</td>
                                             <td className="p-3 text-gray-400 whitespace-nowrap">{formatTimestamp(acw.timestamp)}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     )}
                  </div>
               )}
            </div>

            {/* Static Footer Container */}
            <div className="p-5 border-t border-white/5 bg-[#0A0A0A]/50 backdrop-blur-md flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setSelected(null)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cerrar
              </button>
              {activeTab === 'gestion' && (
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.25)] flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={12} /> Confirmar Cambios
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

