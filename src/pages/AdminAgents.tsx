import { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, query, where, deleteDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, appId as firebaseAppId } from '../firebaseConfig';
// @ts-ignore
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseAppId;
import { getPublicCollection, getPublicDoc, getUserDoc, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  ChevronRight, Search, X, Loader2, TrendingUp,
  CheckCircle, XCircle, RefreshCw, User, Edit3, Save, Clock, Building2, Play
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
  const metricCols = columns.filter(c => !EMAIL_COLS.has(c) && c.toLowerCase() !== 'agente' && c.toLowerCase() !== 'nombre' && c.toLowerCase() !== 'name');

  return (
    <div className="mb-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm ${badgeClass}`}>
          {title}
        </span>
        <span className="text-xs font-bold text-gray-400">{count} agente{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-3xl border border-white/5 bg-[#0A0A0A]/80 backdrop-blur-2xl shadow-lg mt-4 w-full overflow-auto max-h-[420px] p-2 hide-scrollbar">
        <table className="w-full min-w-max text-left border-collapse">
          <thead className="bg-[#111]/80 sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
            <tr>
              <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Agente / Correo
              </th>
              {metricCols.map(col => (
                <th key={col} className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
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
                <td className="px-4 py-4 max-w-[150px] sm:max-w-[200px] md:max-w-[300px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-900/30 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-xs flex-shrink-0 transition-transform group-hover:scale-110">
                      {initials(agent)}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold text-gray-200 leading-tight truncate" title={getName(agent)}>{getName(agent)}</p>
                        <p className="text-[10px] text-gray-500 font-medium truncate" title={getEmail(agent)}>{getEmail(agent)}</p>
                    </div>
                  </div>
                </td>
                {metricCols.map(col => (
                  <td key={col} className="px-4 py-4 text-center text-xs font-bold text-gray-300">
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

      {/* ── Perfil 360° Drawer ──────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 animate-in fade-in">
          <div className="bg-[#0A0A0A]/90 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-full max-w-[600px] h-fit max-h-[85vh] rounded-[2.5rem] flex flex-col overflow-hidden backdrop-blur-3xl animate-in zoom-in-95 duration-300 relative">
          
          {/* Header */}
          <div className="p-8 border-b border-white/10 relative overflow-hidden shrink-0 text-center">
            <button onClick={() => setSelected(null)} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all border border-white/5 z-50">
              <X size={20} />
            </button>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
            <div className="z-10 w-full flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center text-2xl font-black border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] mb-3 mx-auto shrink-0">
                {initials(selected)}
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">{getName(selected) || 'Desconocido'}</h2>
              <p className="text-xs text-gray-400 font-medium mt-1">{getEmail(selected)}</p>
              <div className="mt-3">
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  Planilla: {dynamicGroups[selectedSrc]?.name || selectedSrc.toUpperCase() || 'Sin ÁREA'}
                </span>
              </div>
            </div>
          </div>

          {/* Segmented Control */}
          <div className="flex gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl mx-auto mt-6 mb-6 w-fit shrink-0 relative z-20">
            {[
              { id: 'gestion', label: 'Gestión' },
              { id: 'academy', label: 'Academy' },
              { id: 'quizzes', label: 'Quizzes' },
              { id: 'acw', label: 'ACW' }
            ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`px-4 py-1.5 text-[11px] whitespace-nowrap transition-all rounded-xl ${activeTab === tab.id ? 'bg-blue-600 text-white font-bold shadow-lg scale-105' : 'text-gray-500 hover:text-white font-medium'}`}
               >
                 {tab.label}
               </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-8 pb-8 hide-scrollbar relative z-10">
             {activeTab === 'gestion' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                   <div className="p-6 bg-white/5 rounded-3xl border border-white/10 shadow-sm">
                      <label className="block text-xs font-black text-gray-300 mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" /> Asignación de Área (LOB)
                      </label>
                      <select 
                        value={agentLob}
                        onChange={e => setAgentLob(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer backdrop-blur-md"
                      >
                        {lobs.length === 0 ? <option value="">Cargando áreas...</option> : <><option value="">Selecciona un Área...</option>{lobs.map(lob => <option key={lob.id} value={lob.id}>{lob.name}</option>)}</>}
                      </select>
                   </div>
                   
                   <div className="p-6 bg-white/5 rounded-3xl border border-white/10 shadow-sm relative overflow-hidden">
                      <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-[50px] pointer-events-none" />
                      <label className="block text-xs font-black text-gray-300 mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Edit3 size={16} className="text-purple-400" /> Feedback Comercial
                      </label>
                      <textarea
                        value={suggestion} onChange={e => setSuggestion(e.target.value)}
                        className="w-full h-32 p-4 rounded-2xl border border-white/10 bg-white/5 text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none text-sm transition-all shadow-inner placeholder:text-gray-600 backdrop-blur-md"
                        placeholder="Ingresa sugerencias comerciales personalizadas de este agente..."
                      />
                      <button onClick={handleSave} disabled={saving}
                        className="mt-6 w-full py-4 rounded-2xl font-black bg-white/10 text-white border border-white/20 hover:bg-blue-600 hover:border-transparent transition-all shadow-lg flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Guardar Perfil
                      </button>
                      {saveError && <p className="mt-3 text-xs text-red-500 font-bold text-center">⚠️ {saveError}</p>}
                   </div>
                </div>
             )}

             {activeTab === 'academy' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                   <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">Progreso de Capacitaciones Vistas</h3>
                   {agentAcademy.length === 0 ? (
                      <div className="p-10 text-center bg-white/5 rounded-3xl border border-white/10 border-dashed">
                          <CheckCircle size={32} className="mx-auto mb-3 text-gray-600" />
                          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin Actividad</p>
                          <p className="text-xs text-gray-500 mt-2">El agente aún no ha completado material multimedia en la academia.</p>
                      </div>
                   ) : (
                      agentAcademy.map((acad, idx) => (
                          <div key={idx} className="p-5 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors cursor-default">
                              <div>
                                  <p className="text-sm font-bold text-white">{acad.videoTitle || 'Material Interactivo'}</p>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Completado el {acad.timestamp?.toDate().toLocaleDateString()}</p>
                              </div>
                              <div className="p-2.5 rounded-full bg-green-500/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                  <CheckCircle size={20} />
                              </div>
                          </div>
                      ))
                   )}
                </div>
             )}

             {activeTab === 'quizzes' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                   <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">Evaluaciones y Roleplays</h3>
                   {resultsLoading ? <Loader2 className="animate-spin mx-auto text-blue-500 my-10" /> : agentResults.length === 0 ? (
                      <div className="p-10 text-center bg-white/5 rounded-3xl border border-white/10 border-dashed">
                          <CheckCircle size={32} className="mx-auto mb-3 text-gray-600" />
                          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Aún no hay quizzes</p>
                      </div>
                   ) : (
                      agentResults.map((r, idx) => (
                          <div key={r.id || idx} className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col gap-4 relative overflow-hidden group">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="text-base font-bold text-white">{quizMap[r.quizId] || r.quizTitle || 'Evaluación Operativa'}</p>
                                      <span className="text-[10px] text-gray-400 uppercase tracking-widest">{r.timestamp?.toDate().toLocaleDateString()}</span>
                                  </div>
                                  <div className="text-right">
                                      <span className={`text-2xl font-black drop-shadow-md ${r.score !== undefined ? (r.score >= 80 ? 'text-green-400' : 'text-red-400') : (r.isCorrect ? 'text-green-400' : 'text-red-400')}`}>
                                         {r.score !== undefined ? `${r.score}%` : (r.isCorrect ? 'ÉXITO' : 'FALLO')}
                                      </span>
                                  </div>
                              </div>
                              
                              {r.audioUrl && (
                                  <button onClick={() => window.open(r.audioUrl, '_blank')} className="w-full mt-2 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-blue-500/30 transition-all text-white">
                                      <Play size={20} className="fill-white" /> Escuchar Audio del Roleplay
                                  </button>
                              )}
                          </div>
                      ))
                   )}
                </div>
             )}

             {activeTab === 'acw' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                   <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">Simulaciones Intensivas (ACW Lab)</h3>
                   {agentAcw.length === 0 ? (
                      <div className="p-10 text-center bg-white/5 rounded-3xl border border-white/10 border-dashed">
                          <Clock size={32} className="mx-auto mb-3 text-gray-600" />
                          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin Prácticas ACW</p>
                      </div>
                   ) : (
                      agentAcw.map((acw, idx) => (
                          <div key={acw.id || idx} className="p-5 rounded-3xl bg-white/5 border border-white/10 flex flex-col relative overflow-hidden group">
                              <div className={`absolute left-0 top-0 bottom-0 w-2 ${acw.timeSpent <= 30 ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div className="flex justify-between items-center pl-3 mb-2">
                                  <p className="text-base font-bold text-white max-w-[200px] truncate">{acw.scenarioTitle || 'Simulación de Caso'}</p>
                                  <span className={`text-sm font-black px-4 py-1.5 rounded-xl border ${acw.timeSpent <= 30 ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {acw.timeSpent}s
                                  </span>
                              </div>
                              <div className="pl-3 mt-1 bg-black/20 p-3 rounded-2xl border border-white/5 mx-3 mb-2">
                                 <p className="text-xs text-gray-300 italic">"{acw.comments || acw.notes || 'Tipificación vacía'}"</p>
                              </div>
                              <span className="text-[10px] text-gray-500 pl-3 uppercase tracking-widest">{acw.timestamp?.toDate().toLocaleDateString()}</span>
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

