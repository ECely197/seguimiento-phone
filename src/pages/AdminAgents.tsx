import { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, query, where, deleteDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, appId as firebaseAppId } from '../firebaseConfig';
// @ts-ignore
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseAppId;
import { getPublicCollection, getPublicDoc, getUserDoc, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  ChevronRight, Search, X, Loader2, TrendingUp,
  CheckCircle, XCircle, RefreshCw, User, Edit3, Save, Clock, Building2, Play, Video as VideoIcon, MessageCircle
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
export default function AdminAgents({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
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

  useEffect(() => { loadAll(); fetchQuizzes(); }, []);

  useEffect(() => {
    if (selected) {
      const email = getEmail(selected);
      if (email) {
        fetchAgentResults(email);
        fetchAgentRecord(email);
      }
    }
  }, [selected]);

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
      const allQ = await fetchAllUsersSubcollection('resultados_quizzes'); setAgentResults(allQ.filter((r: any) => r.agentEmail === email));
      const allAcw = await fetchAllUsersSubcollection('acw_attempts'); setAgentAcw(allAcw.filter((r: any) => r.userEmail === email));
      const allAcad = await fetchAllUsersSubcollection('process_views'); setAgentAcademy(allAcad.filter((r: any) => r.userEmail === email));
    } catch (err) { console.error('[AdminAgents] fetchAgentResults:', err); }
    finally { setResultsLoading(false); }
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
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 animate-in fade-in">
          <div className="bg-[#0A0A0A]/90 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] w-full max-w-[650px] h-[85vh] rounded-[3rem] flex flex-col overflow-hidden backdrop-blur-3xl animate-in zoom-in-95 duration-300 relative border-gradient-to-b from-white/10 to-transparent">
          
          {/* Header Island */}
          <div className="p-10 border-b border-white/5 relative overflow-hidden shrink-0 text-center flex flex-col items-center">
            <button onClick={() => setSelected(null)} className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all border border-white/10 z-50 active:scale-90">
              <X size={20} />
            </button>
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
            
            <div className="relative group mb-4">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-600/30 to-indigo-600/30 text-blue-400 flex items-center justify-center text-3xl font-black border border-blue-500/30 shadow-2xl shrink-0">
                {initials(selected)}
              </div>
            </div>

            <h2 className="text-3xl font-black text-white leading-tight tracking-tight">{getName(selected) || 'Desconocido'}</h2>
            <p className="text-sm text-gray-500 font-medium px-4 py-1 bg-white/5 rounded-full border border-white/5 mt-2">{getEmail(selected)}</p>
            
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg bg-blue-600/10 text-blue-400 border border-blue-500/20">
                Operaciones: {dynamicGroups[selectedSrc]?.name || selectedSrc.toUpperCase() || 'Sin ÁREA'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg bg-green-600/10 text-green-400 border border-green-500/20">
                Score: {accuracy()}%
              </span>
            </div>
          </div>

          {/* iOS Style Segmented Control */}
          <div className="px-10 py-6 shrink-0 z-20">
            <div className="flex bg-[#111] p-1.5 rounded-[2rem] border border-white/5 shadow-inner">
              {[
                { id: 'gestion', label: 'Dashboard' },
                { id: 'academy', label: 'Formación' },
                { id: 'quizzes', label: 'Quizzes' },
                { id: 'acw', label: 'ACW Lab' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all rounded-[1.5rem] ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-[0_5px_15px_rgba(37,99,235,0.3)] scale-100' : 'text-gray-500 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area (Glass Container) */}
          <div className="flex-1 overflow-y-auto px-10 pb-10 hide-scrollbar relative z-10">
             {activeTab === 'gestion' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 shadow-inner group">
                      <label className="block text-[10px] font-black text-gray-500 mb-4 uppercase tracking-[0.3em] group-hover:text-blue-500 transition-colors">
                        Sincronización Operativa (LOB)
                      </label>
                      <select 
                        value={agentLob}
                        onChange={e => setAgentLob(e.target.value)}
                        className="w-full px-6 py-5 rounded-2xl border border-white/10 bg-black/40 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer backdrop-blur-md shadow-lg appearance-none"
                      >
                        {lobs.length === 0 ? <option value="">Cargando áreas...</option> : <><option value="">Selecciona un Área...</option>{lobs.map(lob => <option key={lob.id} value={lob.id}>{lob.name}</option>)}</>}
                      </select>
                   </div>
                   
                   <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 shadow-inner relative overflow-hidden group">
                      <label className="block text-[10px] font-black text-gray-500 mb-4 uppercase tracking-[0.3em] group-hover:text-purple-400 transition-colors">
                        Estrategia de Mejora (Feedback)
                      </label>
                      <textarea
                        value={suggestion} onChange={e => setSuggestion(e.target.value)}
                        className="w-full h-40 p-6 rounded-3xl border border-white/5 bg-black/40 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm transition-all shadow-inner placeholder:text-gray-700 font-medium"
                        placeholder="Define los puntos de dolor y oportunidades comerciales detectadas..."
                      />
                      <button onClick={handleSave} disabled={saving}
                        className="mt-8 w-full py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs bg-white text-black hover:bg-gray-200 transition-all shadow-[0_15px_30px_rgba(255,255,255,0.05)] flex items-center justify-center gap-3 active:scale-95">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={20} />}
                        Confirmar Cambios del Perfil
                      </button>
                      {saveError && <p className="mt-4 text-xs text-red-500 font-black text-center animate-pulse">⚠️ {saveError}</p>}
                   </div>
                </div>
             )}

             {activeTab === 'academy' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Progresión de Aprendizaje</h3>
                   {agentAcademy.length === 0 ? (
                       <div className="p-16 text-center bg-white/[0.02] rounded-[2.5rem] border-2 border-dashed border-white/5">
                           <Play size={48} className="mx-auto mb-6 text-gray-800 opacity-50" />
                           <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Sin Actividad Academy</p>
                       </div>
                   ) : (
                       agentAcademy.map((acad, idx) => (
                           <div key={idx} className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm group">
                               <div className="flex gap-4 items-center">
                                   <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                                       <VideoIcon size={20} />
                                   </div>
                                   <div>
                                       <p className="text-base font-bold text-white leading-tight">{acad.videoTitle || 'Material de Formación'}</p>
                                       <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1.5 font-black">{acad.timestamp?.toDate().toLocaleDateString()} — COMPLETADO</p>
                                   </div>
                               </div>
                               <div className="p-3 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                                   <CheckCircle size={20} />
                               </div>
                           </div>
                       ))
                   )}
                </div>
             )}

             {activeTab === 'quizzes' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Logros y Evaluaciones</h3>
                   {resultsLoading ? <Loader2 className="animate-spin mx-auto text-blue-500 my-10" /> : agentResults.length === 0 ? (
                       <div className="p-16 text-center bg-white/[0.02] rounded-[2.5rem] border-2 border-dashed border-white/5">
                           <TrendingUp size={48} className="mx-auto mb-6 text-gray-800 opacity-50" />
                           <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Aún no evaluado</p>
                       </div>
                   ) : (
                       agentResults.map((r, idx) => (
                           <div key={r.id || idx} className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex flex-col gap-6 relative overflow-hidden group hover:bg-white/5 transition-all shadow-inner">
                               <div className={`absolute top-0 bottom-0 left-0 w-2 ${r.isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                               <div className="flex justify-between items-start">
                                   <div>
                                       <h4 className="text-xl font-black text-white">{quizMap[r.quizId] || r.quizTitle || 'Evaluación'}</h4>
                                       <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black mt-2 inline-block bg-white/5 px-3 py-1 rounded-full">{r.timestamp?.toDate().toLocaleDateString()}</span>
                                   </div>
                                   <div className={`text-4xl font-black shadow-text ${r.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                      {r.isCorrect ? 'OK' : 'FAIL'}
                                   </div>
                               </div>
                               
                               {r.audioUrl && (
                                   <button onClick={() => window.open(r.audioUrl, '_blank')} className="w-full p-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 shadow-2xl hover:bg-gray-100 transition-all active:scale-95">
                                       <Play size={18} fill="currentColor" /> Reproducir Roleplay
                                   </button>
                               )}
                           </div>
                       ))
                   )}
                </div>
             )}

             {activeTab === 'acw' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Métricas de Velocidad (ACW Lab)</h3>
                   {agentAcw.length === 0 ? (
                       <div className="p-16 text-center bg-white/[0.02] rounded-[2.5rem] border-2 border-dashed border-white/5">
                           <Clock size={48} className="mx-auto mb-6 text-gray-800 opacity-50" />
                           <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Sin Pruebas de Velocidad</p>
                       </div>
                   ) : (
                       agentAcw.sort((a: any, b: any) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0)).map((acw, idx) => (
                           <div key={acw.id || idx} className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex flex-col relative overflow-hidden group shadow-inner">
                               <div className="flex justify-between items-center mb-6">
                                   <div className="flex items-center gap-4">
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${acw.timeSpent <= 30 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                         {acw.timeSpent}s
                                       </div>
                                       <div>
                                           <p className="text-base font-bold text-white truncate max-w-[200px]">{acw.scenarioTitle || 'Simulación Cascada'}</p>
                                           <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mt-1">{acw.timestamp?.toDate().toLocaleDateString()}</p>
                                       </div>
                                   </div>
                                   <span className={`text-[10px] font-black px-4 py-2 rounded-full border tracking-widest uppercase ${acw.timeSpent <= 30 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                     {acw.timeSpent <= 30 ? 'FAST' : 'OUTSIDE SLA'}
                                   </span>
                               </div>
                               <div className="bg-black/20 p-5 rounded-[1.5rem] border border-white/5 italic">
                                  <p className="text-xs text-gray-400 leading-relaxed">"{acw.comments || acw.inputs?.comment || 'Evidencia de tipificación vacía'}"</p>
                               </div>
                           </div>
                       ))
                   )}
                </div>
             )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

