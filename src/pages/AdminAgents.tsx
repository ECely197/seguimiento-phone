import { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, query, where, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, appId as firebaseAppId } from '../firebaseConfig';
// @ts-ignore
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseAppId;
import { getPublicCollection, getPublicDoc, getUserDoc, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  ChevronRight, Search, X, Loader2, TrendingUp,
  CheckCircle, XCircle, RefreshCw, User, Edit3, Save, Clock, Building2
} from 'lucide-react';
import { updateAgentSuggestion, getMainAgents, getRecuperoAgents, getB2xAgents } from '../api/sheetService';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent { [key: string]: any; }
interface AgentGroup { agents: Agent[]; columns: string[]; }
interface LobConfig { id: string; name: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const deriveColumns = (rows: Agent[]): string[] =>
  rows.length ? Object.keys(rows[0]) : [];

const getEmail = (a: Agent) => a.correo ?? a.Correo ?? a.email ?? a.Email ?? '';
const getName  = (a: Agent) => a.agente ?? a.Agente ?? a.nombre ?? a.name ?? '';
const initials = (a: Agent) => getName(a).substring(0, 2).toUpperCase() || '??';

const NUM_COLS = new Set(['AHT Real', 'ATT', 'ACW', 'HS Gestionadas', 'Prod. Tot. Llamadas', 'Prod. Tot. Efectivas', 'AHT', 'FRT']);
const PCT_COLS = new Set(['RES', 'PSAT', 'No contestada', 'SAT']);
const INT_COLS = new Set(['Efectiva', 'Tot. Llamadas']);

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
  if (INT_COLS.has(col)) return fmtInt(v);
  if (NUM_COLS.has(col)) return fmtNum(v);
  if (PCT_COLS.has(col)) return fmtPct(v);
  return String(v);
};

const EMAIL_COLS = new Set(['correo', 'email', 'Correo', 'Email']);

// ── Shared table sub-component ─────────────────────────────────────────────────
function AgentTable({
  title, badgeClass, count, agents, columns, selected, onSelect,
}: {
  title: string; badgeClass: string; count: number;
  agents: Agent[]; columns: string[];
  selected: Agent | null; onSelect: (a: Agent) => void;
}) {
  const metricCols = columns.filter(c => !EMAIL_COLS.has(c));

  return (
    <div className="mb-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm ${badgeClass}`}>
          {title}
        </span>
        <span className="text-xs font-bold text-gray-400">{count} agente{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-[24px] border border-m3-surface-variant/30 bg-white dark:bg-[#1E1E1E] shadow-sm overflow-auto max-h-[420px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-m3-surface-variant/20 dark:bg-white/5 sticky top-0 backdrop-blur-md z-10">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black text-m3-secondary/60 dark:text-m3-on-surface-dark/50 uppercase tracking-widest">
                Agente / Correo
              </th>
              {metricCols.map(col => (
                <th key={col} className="px-4 py-3 text-[10px] font-black text-m3-secondary/60 dark:text-m3-on-surface-dark/50 uppercase tracking-widest text-center">
                  {col}
                </th>
              ))}
              <th className="px-4 py-3 w-8">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={metricCols.length + 2} className="p-12 text-center text-gray-400 text-xs italic">
                  No se encontraron resultados en esta categoría.
                </td>
              </tr>
            ) : agents.map((agent, idx) => (
              <tr
                key={getEmail(agent) || idx}
                onClick={() => onSelect(agent)}
                className={`group hover:bg-m3-primary/5 dark:hover:bg-m3-primary-dark/5 transition-all cursor-pointer
                  ${selected && getEmail(selected) === getEmail(agent) ? 'bg-m3-primary/10 dark:bg-m3-primary-dark/20' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-m3-primary/10 dark:bg-m3-primary-dark/20 flex items-center justify-center text-m3-primary dark:text-m3-primary-dark font-black text-xs flex-shrink-0 transition-transform group-hover:scale-110">
                      {initials(agent)}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-m3-secondary dark:text-white leading-tight">{getName(agent)}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{getEmail(agent)}</p>
                    </div>
                  </div>
                </td>
                {metricCols.map(col => (
                  <td key={col} className="px-4 py-3 text-center text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark/80">
                    {fmtCell(col, agent[col])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-m3-primary transition-colors" />
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
  const [mainGroup,     setMainGroup]     = useState<AgentGroup>({ agents: [], columns: [] });
  const [recuperoGroup, setRecuperoGroup] = useState<AgentGroup>({ agents: [], columns: [] });
  const [b2xGroup,      setB2xGroup]      = useState<AgentGroup>({ agents: [], columns: [] });
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [dynamicGroup,  setDynamicGroup]   = useState<AgentGroup>({ agents: [], columns: [] });

  // UI
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selected,      setSelected]      = useState<Agent | null>(null);
  const [selectedSrc,   setSelectedSrc]   = useState<'main' | 'recupero' | 'b2x'>('main');
  const [suggestion,    setSuggestion]    = useState('');
  const [agentLob,      setAgentLob]      = useState('phone');
  const [lobs,          setLobs]          = useState<LobConfig[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);

  // Quiz
  const [agentResults,   setAgentResults]   = useState<any[]>([]);
  const [agentAcw,       setAgentAcw]       = useState<any[]>([]);
  const [quizMap,        setQuizMap]        = useState<Record<string, string>>({});
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => { loadAll(); fetchQuizzes(); fetchLobs(); }, [globalLobFilter]);

  useEffect(() => {
    if (selected) {
      const email = getEmail(selected);
      if (email) {
        fetchAgentResults(email);
        fetchAgentRecord(email);
      }
    }
  }, [selected]);

  const fetchLobs = async () => {
    try {
      const snap = await getDocs(getPublicCollection('lobs'));
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      setLobs(list);
    } catch (err) { console.error('[AdminAgents] fetchLobs:', err); }
  };

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
      // 1. Fetch Legacy 
      const [mainRaw, recuperoRaw, b2xRaw] = await Promise.all([
        getMainAgents(),
        getRecuperoAgents(),
        getB2xAgents(),
      ]);
      const m = Array.isArray(mainRaw)     ? mainRaw     : [];
      const r = Array.isArray(recuperoRaw) ? recuperoRaw : [];
      const b = Array.isArray(b2xRaw)      ? b2xRaw      : [];
      setMainGroup({     agents: m, columns: deriveColumns(m) });
      setRecuperoGroup({ agents: r, columns: deriveColumns(r) });
      setB2xGroup({      agents: b, columns: deriveColumns(b) });

      // 2. Fetch Dynamic if explicitly selected
      if (globalLobFilter && !['all', 'phone', 'recupero', 'b2x'].includes(globalLobFilter)) {
          const lSnap = await getDoc(getPublicDoc('lobs', globalLobFilter));
          const lData = lSnap.data();
          if (lData?.currentMetricsUrl) {
              const res = await fetch(lData.currentMetricsUrl, { redirect: 'follow' });
              const json = await res.json();
              const agents = Array.isArray(json) ? json : json.data || [];
              setDynamicGroup({ agents, columns: deriveColumns(agents) });
          } else {
              setDynamicGroup({ agents: [], columns: [] });
          }
      }
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
      
      if (!snap.empty) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', snap.docs[0].id), {
          lob: agentLob,
          updatedAt: serverTimestamp()
        });
      }

      const patch = (prev: AgentGroup): AgentGroup => ({
        ...prev,
        agents: prev.agents.map(a =>
          getEmail(a) === getEmail(selected!) ? { ...a, sugerencia: suggestion } : a
        ),
      });
      if (selectedSrc === 'main') setMainGroup(patch); else if (selectedSrc === 'recupero') setRecuperoGroup(patch); else setB2xGroup(patch);
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
  const applyFilters = (agents: Agent[], sourceLob: string) => {
    // 1. Filter by Global LOB Selector
    if (globalLobFilter && globalLobFilter !== 'all' && globalLobFilter !== sourceLob) {
        return [];
    }

    // 2. Filter by Search Term
    return !t ? agents : agents.filter(a =>
      getName(a).toLowerCase().includes(t) || getEmail(a).toLowerCase().includes(t)
    );
  };

  const fMain     = applyFilters(mainGroup.agents, 'phone');
  const fRecupero = applyFilters(recuperoGroup.agents, 'recupero');
  const fB2x      = applyFilters(b2xGroup.agents, 'b2x');

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
        <div className="flex justify-between items-center mb-8 bg-m3-surface-variant/5 dark:bg-white/[0.02] p-4 rounded-[28px] border border-m3-surface-variant/20">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text" placeholder="Buscar agente por nombre o correo..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-m3-surface-variant dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none shadow-sm transition-all"
            />
          </div>
          <button onClick={loadAll} className="flex items-center gap-2 px-5 py-3 bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 rounded-2xl font-bold text-sm transition-all">
            <RefreshCw size={18} /> Actualizar Datos
          </button>
        </div>

        {loadError && (
          <div className="mb-6 px-6 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-3">
            <XCircle size={20} /> {loadError}
          </div>
        )}

        {/* Dynamic Table Rendering based on filters */}
        {(globalLobFilter === 'all' || globalLobFilter === 'phone') && (
            <AgentTable
                title="Phone / General"
                badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                count={fMain.length}
                agents={fMain}
                columns={mainGroup.columns}
                selected={selected}
                onSelect={a => { setSelected(a); setSelectedSrc('main'); }}
            />
        )}

        {(globalLobFilter === 'all' || globalLobFilter === 'recupero') && (
            <AgentTable
                title="Recupero"
                badgeClass="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                count={fRecupero.length}
                agents={fRecupero}
                columns={recuperoGroup.columns}
                selected={selected}
                onSelect={a => { setSelected(a); setSelectedSrc('recupero'); }}
            />
        )}

        {(globalLobFilter === 'all' || globalLobFilter === 'b2x') && (
            <AgentTable
                title="B2X Metrics"
                badgeClass="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                count={fB2x.length}
                agents={fB2x}
                columns={b2xGroup.columns}
                selected={selected}
                onSelect={a => { setSelected(a); setSelectedSrc('b2x'); }}
            />
        )}

        {/* Dynamic LOB Table */}
        {globalLobFilter !== 'all' && !['phone', 'recupero', 'b2x'].includes(globalLobFilter!) && (
            <AgentTable
                title={lobs.find(l => l.id === globalLobFilter)?.name || globalLobFilter!}
                badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                count={dynamicGroup.agents.length}
                agents={dynamicGroup.agents.filter(a => !t || getName(a).toLowerCase().includes(t) || getEmail(a).toLowerCase().includes(t))}
                columns={dynamicGroup.columns}
                selected={null} // Keep it simple for now or implement full sync
                onSelect={a => { setSelected(a); }}
            />
        )}
        
        {globalLobFilter !== 'all' && globalLobFilter !== 'phone' && globalLobFilter !== 'recupero' && globalLobFilter !== 'b2x' && (
           <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-white/10">
              <Building2 size={48} className="text-gray-300 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin datos de planilla para {globalLobFilter}</p>
              <p className="text-xs text-gray-500 mt-2 max-w-xs">Este LOB dinámico aún no tiene una fuente de datos (Google Sheet) vinculada al directorio.</p>
           </div>
        )}
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white dark:bg-[#1E1E1E] border-l border-m3-surface-variant/30 dark:border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-[60]">
          <div className="p-6 border-b border-m3-surface-variant/30 flex justify-between items-center bg-m3-surface-variant/5">
            <div>
              <h2 className="text-xl font-black text-m3-secondary dark:text-white">Perfil Operativo</h2>
              <p className="text-[10px] font-black uppercase text-m3-primary tracking-widest mt-1">Gestión Técnica de Agente</p>
            </div>
            <button onClick={() => setSelected(null)} className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-full transition-all">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Header: Identity */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-gradient-to-br from-m3-primary to-blue-600 rounded-[28px] flex items-center justify-center text-3xl font-black text-white shadow-lg">
                {initials(selected)}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-m3-secondary dark:text-white leading-tight">{getName(selected) || '—'}</h3>
                <p className="text-sm text-gray-500 font-medium mb-2">{getEmail(selected)}</p>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm
                  ${selectedSrc === 'recupero' ? 'bg-orange-100 text-orange-800' : 
                    selectedSrc === 'b2x' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                  Planilla: {selectedSrc.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-3xl bg-m3-primary/5 dark:bg-m3-primary-dark/10 border border-m3-primary/10 text-center">
                <span className="text-[10px] font-black text-m3-primary uppercase tracking-widest">Precisión Quiz</span>
                <p className="text-3xl font-black text-m3-primary mt-1">{accuracy()}%</p>
              </div>
              <div className="p-4 rounded-3xl bg-m3-secondary/5 dark:bg-white/5 border border-m3-secondary/10 dark:border-white/10 text-center">
                <span className="text-[10px] font-black text-m3-secondary/60 dark:text-gray-400 uppercase tracking-widest">Intentos</span>
                <p className="text-3xl font-black text-m3-secondary dark:text-white mt-1">{agentResults.length}</p>
              </div>
            </div>

            {/* Line of Business Selector */}
            <div className="p-5 bg-white dark:bg-[#252525] rounded-[32px] border border-m3-surface-variant/30 dark:border-white/10 shadow-sm ring-1 ring-m3-primary/5">
              <label className="block text-xs font-black text-m3-secondary dark:text-gray-300 mb-4 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} className="text-m3-primary" /> Asignación de Área (LOB)
              </label>
              <select 
                value={agentLob}
                onChange={e => setAgentLob(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-m3-surface-variant/50 dark:border-white/10 bg-m3-surface/50 dark:bg-black/20 text-sm font-bold focus:ring-2 focus:ring-m3-primary outline-none transition-all cursor-pointer"
              >
                {lobs.length === 0 ? (
                  <option value="">Cargando áreas...</option>
                ) : (
                  <>
                    <option value="">Selecciona un Área...</option>
                    {lobs.map(lob => (
                      <option key={lob.id} value={lob.id}>{lob.name}</option>
                    ))}
                  </>
                )}
              </select>
              <p className="text-[10px] text-gray-500 mt-3 leading-relaxed font-medium italic">
                * Esta asignación restringe el contenido visible (Capacitaciones, ACW, Quizzes) en la interfaz del agente.
              </p>
            </div>

            {/* Feedback / Suggestions */}
            <div>
              <label className="block text-xs font-black text-m3-secondary dark:text-gray-300 mb-4 uppercase tracking-widest flex items-center gap-2">
                <Edit3 size={16} className="text-m3-primary" /> Feedback Comercial
              </label>
              <textarea
                value={suggestion} onChange={e => setSuggestion(e.target.value)}
                className="w-full h-32 p-5 rounded-3xl border border-m3-surface-variant/50 dark:border-white/10 bg-m3-surface/50 dark:bg-black/20 focus:ring-2 focus:ring-m3-primary outline-none resize-none text-m3-secondary dark:text-white text-sm leading-relaxed transition-all shadow-inner"
                placeholder="Ingresa sugerencias para el agente..."
              />
              <button onClick={handleSave} disabled={saving}
                className="mt-4 w-full py-4 rounded-2xl font-black bg-m3-primary text-white hover:bg-m3-primary/90 transition-all shadow-lg hover:shadow-m3-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 text-sm uppercase tracking-widest">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Actualizar Perfil
              </button>
              {saveError && <p className="mt-3 text-xs text-red-500 font-bold text-center">⚠️ {saveError}</p>}
            </div>

            {/* Results Sections */}
            <div className="space-y-4 pt-4 border-t border-m3-surface-variant/20">
               <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">Historial de Actividad</h3>
               
               {/* Quizzes */}
               <div className="space-y-3">
                 {agentResults.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-black/10 rounded-3xl border-2 border-dashed border-gray-100 dark:border-white/5 opacity-40">
                        <CheckCircle size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-bold uppercase">Sin historial de Quizzes</p>
                    </div>
                 ) : (
                    agentResults.map(r => (
                        <div key={r.id} className="p-4 rounded-[24px] bg-white dark:bg-[#252525] border border-m3-surface-variant/20 dark:border-white/5 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <p className="text-xs font-bold text-m3-secondary dark:text-white leading-tight flex-1 pr-4">{quizMap[r.quizId] || 'Quiz Operativo'}</p>
                                <div className={`p-1.5 rounded-xl ${r.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {r.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                <span>{r.timestamp?.toDate().toLocaleDateString()}</span>
                                <button onClick={() => deleteResult(r)} className="text-m3-primary hover:text-m3-primary/70 transition-colors">Resetear</button>
                            </div>
                        </div>
                    ))
                 )}
               </div>

               {/* ACW */}
               <div className="space-y-3">
                 {agentAcw.slice(0, 5).map(acw => (
                    <div key={acw.id} className="p-4 rounded-[24px] bg-gray-50 dark:bg-black/10 border border-m3-surface-variant/20 dark:border-white/5">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-xs font-bold text-m3-secondary dark:text-gray-300 truncate max-w-[150px]">{acw.scenarioTitle}</p>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${acw.timeSpent <= 30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{acw.timeSpent}s</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{acw.timestamp?.toDate().toLocaleDateString()}</p>
                    </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
