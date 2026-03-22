import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  ChevronRight, Search, X, Loader2, TrendingUp,
  CheckCircle, XCircle, RefreshCw, User, Edit3, Save, Clock
} from 'lucide-react';
import { updateAgentSuggestion, getMainAgents, getRecuperoAgents } from '../api/sheetService';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent { [key: string]: any; }
interface AgentGroup { agents: Agent[]; columns: string[]; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const deriveColumns = (rows: Agent[]): string[] =>
  rows.length ? Object.keys(rows[0]) : [];

const getEmail = (a: Agent) => a.correo ?? a.Correo ?? a.email ?? a.Email ?? '';
const getName  = (a: Agent) => a.agente ?? a.Agente ?? a.nombre ?? a.name ?? '';
const initials = (a: Agent) => getName(a).substring(0, 2).toUpperCase() || '??';

/** Columns that should be rounded to 1 decimal */
const NUM_COLS = new Set(['AHT Real', 'ATT', 'ACW', 'HS Gestionadas', 'Prod. Tot. Llamadas', 'Prod. Tot. Efectivas']);
/** Columns that are rates (may arrive as 0-1 decimal or already %-formatted) */
const PCT_COLS = new Set(['RES', 'PSAT', 'No contestada']);
/** Columns that are plain integers (no % symbol, no decimals) */
const INT_COLS = new Set(['Efectiva', 'Tot. Llamadas']);

const fmtNum = (v: any): string => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? (v ?? '—') : n.toFixed(1);
};

const fmtPct = (v: any): string => {
  const s = String(v ?? '');
  if (s.includes('%')) return s;                            // already formatted
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return s || '—';
  // If value is between 0 and 1, treat as decimal rate → multiply by 100
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
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${badgeClass}`}>
          {title}
        </span>
        <span className="text-sm text-gray-400">{count} agente{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-3xl border border-m3-surface-variant/30 bg-white dark:bg-[#1E1E1E] shadow-sm overflow-auto max-h-[420px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-m3-surface-variant/40 dark:bg-white/10 sticky top-0 backdrop-blur-md">
            <tr>
              <th className="px-2 py-2 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider whitespace-nowrap">
                Correo
              </th>
              {metricCols.map(col => (
                <th key={col} className="px-2 py-2 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">
                  {col}
                </th>
              ))}
              <th className="px-2 py-2 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-right">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={metricCols.length + 2} className="p-8 text-center text-gray-400 text-xs">
                  No se encontraron resultados.
                </td>
              </tr>
            ) : agents.map((agent, idx) => (
              <tr
                key={getEmail(agent) || idx}
                onClick={() => onSelect(agent)}
                className={`group hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-colors cursor-pointer
                  ${selected && getEmail(selected) === getEmail(agent) ? 'bg-m3-primary/10 dark:bg-m3-primary/20' : ''}`}
              >
                <td className="px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-m3-primary/10 flex items-center justify-center text-m3-primary font-bold text-[10px] flex-shrink-0">
                      {initials(agent)}
                    </div>
                    <span className="text-xs font-medium text-m3-secondary dark:text-m3-on-surface-dark whitespace-nowrap">
                      {getEmail(agent)}
                    </span>
                  </div>
                </td>
                {metricCols.map(col => (
                  <td key={col} className="px-2 py-1 text-center text-xs text-m3-secondary dark:text-m3-on-surface-dark">
                    {fmtCell(col, agent[col])}
                  </td>
                ))}
                <td className="px-2 py-1 text-right">
                  <button className="p-1 hover:bg-m3-primary/10 rounded-full text-m3-primary transition-colors">
                    <ChevronRight size={14} />
                  </button>
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
export default function AdminAgents() {
  // Data
  const [mainGroup,     setMainGroup]     = useState<AgentGroup>({ agents: [], columns: [] });
  const [recuperoGroup, setRecuperoGroup] = useState<AgentGroup>({ agents: [], columns: [] });
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);

  // UI
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selected,      setSelected]      = useState<Agent | null>(null);
  const [selectedSrc,   setSelectedSrc]   = useState<'main' | 'recupero'>('main');
  const [suggestion,    setSuggestion]    = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);

  // Quiz
  const [agentResults,   setAgentResults]   = useState<any[]>([]);
  const [agentAcw,       setAgentAcw]       = useState<any[]>([]);
  const [quizMap,        setQuizMap]        = useState<Record<string, string>>({});
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => { loadAll(); fetchQuizzes(); }, []);

  useEffect(() => {
    if (selected) {
      const email = getEmail(selected);
      if (email) fetchAgentResults(email);
    }
  }, [selected]);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [mainRaw, recuperoRaw] = await Promise.all([
        getMainAgents(),
        getRecuperoAgents(),
      ]);
      const m = Array.isArray(mainRaw)     ? mainRaw     : [];
      const r = Array.isArray(recuperoRaw) ? recuperoRaw : [];
      setMainGroup({     agents: m, columns: deriveColumns(m) });
      setRecuperoGroup({ agents: r, columns: deriveColumns(r) });
    } catch (err) {
      console.error('[AdminAgents] loadAll:', err);
      setLoadError('No se pudieron cargar los agentes.');
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
      const qQuizzes = {} as any; // placeholder
      const qAcw = {} as any; // placeholder

      const [snapQuizzes, snapAcw] = await Promise.all([
        getDocs(qQuizzes),
        getDocs(qAcw)
      ]);

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
      // Optimistic update
      setAgentResults(prev => prev.map(res => res.id === r.id ? { ...res, reviewStatus: newStatus } : res));
    } catch (err) {
      console.error('Error updating reviewStatus:', err);
      alert('Hubo un error al guardar la revisión.');
    }
  };

  const accuracy = () => {
    if (!agentResults.length) return 0;
    return Math.round((agentResults.filter(r => r.isCorrect).length / agentResults.length) * 100);
  };

  const handleSelect = (agent: Agent, src: 'main' | 'recupero') => {
    setSelected(agent);
    setSelectedSrc(src);
    setSuggestion(agent.sugerencia || '');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true); setSaveError(null);
    try {
      await updateAgentSuggestion(getEmail(selected), suggestion);
      const patch = (prev: AgentGroup): AgentGroup => ({
        ...prev,
        agents: prev.agents.map(a =>
          getEmail(a) === getEmail(selected!) ? { ...a, sugerencia: suggestion } : a
        ),
      });
      if (selectedSrc === 'main') setMainGroup(patch); else setRecuperoGroup(patch);
      setSelected(null);
    } catch { setSaveError('Error al guardar la sugerencia.'); }
    finally { setSaving(false); }
  };

  // Filter
  const t = searchTerm.toLowerCase();
  const filter = (agents: Agent[]) => !t ? agents : agents.filter(a =>
    getName(a).toLowerCase().includes(t) || getEmail(a).toLowerCase().includes(t)
  );
  const fMain     = filter(mainGroup.agents);
  const fRecupero = filter(recuperoGroup.agents);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="animate-spin text-m3-primary" size={32} />
    </div>
  );

  return (
    <div className="flex h-full gap-6">

      {/* ── Tables area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-auto pr-1 animate-in fade-in duration-500">

        {/* Toolbar */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Directorio de Agentes</h3>
            <p className="text-sm text-gray-500">Visualiza y gestiona el rendimiento del equipo.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} className="p-2 hover:bg-m3-primary/10 rounded-full text-m3-primary transition-colors" title="Recargar">
              <RefreshCw size={18} />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text" placeholder="Buscar por nombre o correo..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-full border border-m3-surface-variant dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none min-w-[280px]"
              />
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-2xl text-sm">
            {loadError}
          </div>
        )}

        {/* Table 1: Phone / B2X */}
        <AgentTable
          title="Phone / B2X"
          badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          count={fMain.length}
          agents={fMain}
          columns={mainGroup.columns}
          selected={selected}
          onSelect={a => handleSelect(a, 'main')}
        />

        {/* Visual divider */}
        <div className="flex items-center gap-3 my-2 mb-6">
          <div className="flex-1 border-t border-m3-surface-variant/40 dark:border-white/10" />
          <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Recupero</span>
          <div className="flex-1 border-t border-m3-surface-variant/40 dark:border-white/10" />
        </div>

        {/* Table 2: Recupero */}
        <AgentTable
          title="Recupero"
          badgeClass="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
          count={fRecupero.length}
          agents={fRecupero}
          columns={recuperoGroup.columns}
          selected={selected}
          onSelect={a => handleSelect(a, 'recupero')}
        />

        {/* Visual divider */}
        <div className="flex items-center gap-3 my-2 mb-6 mt-6">
          <div className="flex-1 border-t border-m3-surface-variant/40 dark:border-white/10" />
          <span className="text-xs text-purple-400 uppercase tracking-widest font-semibold">Visitantes</span>
          <div className="flex-1 border-t border-m3-surface-variant/40 dark:border-white/10" />
        </div>

        {/* Table 3: Invitados */}
        <AgentTable
          title="Actividad Visitantes"
          badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
          count={1}
          agents={[{ correo: 'invitado@visitante.com', agente: 'Actividad de Invitados' }]}
          columns={[]}
          selected={selected}
          onSelect={a => handleSelect(a, 'main')}
        />
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      {selected && (
        <div className="w-96 bg-white dark:bg-[#1E1E1E] border-l border-m3-surface-variant/30 dark:border-white/10 flex flex-col shadow-xl animate-in slide-in-from-right duration-300 z-20">
          <div className="p-6 border-b border-m3-surface-variant/30 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-m3-secondary dark:text-white">Detalle del Agente</h2>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block
                ${selectedSrc === 'recupero'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                {selectedSrc === 'recupero' ? 'Recupero' : 'Phone / B2X'}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Avatar */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-m3-primary/10 dark:bg-m3-primary/20 rounded-full flex items-center justify-center text-3xl font-bold text-m3-primary mb-3">
                {initials(selected) || <User />}
              </div>
              <h3 className="text-xl font-bold text-m3-secondary dark:text-white">{getName(selected) || '—'}</h3>
              <p className="text-sm text-gray-500">{getEmail(selected)}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-m3-surface-variant/20 dark:bg-white/5 text-center">
                <span className="text-xs text-gray-500 uppercase">Precisión</span>
                <p className="text-2xl font-bold text-m3-primary">{accuracy()}%</p>
              </div>
              <div className="p-4 rounded-2xl bg-m3-surface-variant/20 dark:bg-white/5 text-center">
                <span className="text-xs text-gray-500 uppercase">Quizzes</span>
                <p className="text-2xl font-bold text-m3-secondary dark:text-white">{agentResults.length}</p>
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label className="block text-sm font-bold text-m3-secondary dark:text-white mb-2 flex items-center gap-2">
                <Edit3 size={16} /> Sugerencia / Feedback
              </label>
              <textarea
                value={suggestion} onChange={e => setSuggestion(e.target.value)}
                className="w-full h-32 p-4 rounded-xl border border-m3-surface-variant/50 dark:border-white/10 bg-m3-surface dark:bg-[#2C2C2C] focus:ring-2 focus:ring-m3-primary outline-none resize-none text-m3-secondary dark:text-white text-sm leading-relaxed"
                placeholder="Escribe un feedback constructivo..."
              />
              <button onClick={handleSave} disabled={saving}
                className="mt-2 w-full py-2 rounded-xl font-bold bg-m3-primary text-white hover:bg-m3-primary/90 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 text-sm">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar Feedback
              </button>
              {saveError && <p className="mt-2 text-xs text-red-500">{saveError}</p>}
            </div>

            {/* Quiz results */}
            <div>
              <h3 className="font-bold text-m3-secondary dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} /> Rendimiento en Quizzes
              </h3>
              {resultsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-m3-primary" /></div>
              ) : agentResults.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No ha realizado quizzes aún.</p>
              ) : (
                <div className="space-y-3">
                  {agentResults.map(r => (
                    <div key={r.id} className={`p-4 rounded-xl border transition-colors ${
                      r.quizType === 'open-audio' && r.reviewStatus === 'pending'
                        ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
                        : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="pr-4">
                          <p className="text-sm font-bold text-m3-secondary dark:text-white line-clamp-2">
                            {quizMap[r.quizId] || 'Quiz Eliminado'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{r.timestamp?.toDate().toLocaleDateString()}</p>
                        </div>
                        {r.quizType === 'open-audio' ? (
                           <div className={`p-1.5 rounded-full ${
                             r.reviewStatus === 'approved' ? 'bg-green-100 text-green-700' :
                             r.reviewStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                             'bg-amber-100 text-amber-700'
                           }`}>
                             {r.reviewStatus === 'approved' ? <CheckCircle size={16} /> :
                              r.reviewStatus === 'rejected' ? <XCircle size={16} /> : 
                              <Clock size={16} />}
                           </div>
                        ) : (
                          <div className={`p-1.5 rounded-full ${r.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {r.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          </div>
                        )}
                      </div>
                      
                      {r.audioUrl && <audio src={r.audioUrl} controls className="w-full h-8 mb-3" />}
                      
                      {/* Sub-actions for open-audio */}
                      {r.quizType === 'open-audio' && (
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => handleUpdateReviewStatus(r, 'approved')}
                            className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              r.reviewStatus === 'approved'
                                ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-600 ring-offset-2 dark:ring-offset-[#1E1E1E]'
                                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            }`}
                          >
                            <CheckCircle size={14} /> Aprobado
                          </button>
                          <button
                            onClick={() => handleUpdateReviewStatus(r, 'rejected')}
                            className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              r.reviewStatus === 'rejected'
                                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600 ring-offset-2 dark:ring-offset-[#1E1E1E]'
                                : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            <XCircle size={14} /> Rechazado
                          </button>
                        </div>
                      )}

                      <button onClick={() => deleteResult(r)}
                        className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent dark:hover:border-red-900/30">
                        <RefreshCw size={14} /> Habilitar Nueva Oportunidad
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACW results */}
            <div className="mt-8">
              <h3 className="font-bold text-m3-secondary dark:text-white mb-4 flex items-center gap-2">
                <Clock size={18} /> Simulador ACW
              </h3>
              {resultsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-m3-primary" /></div>
              ) : agentAcw.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No ha realizado prácticas ACW.</p>
              ) : (
                <div className="space-y-3">
                  {agentAcw.map(acw => (
                    <div key={acw.id} className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-bold text-m3-secondary dark:text-white line-clamp-2">
                            {acw.scenarioTitle || 'Escenario'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{acw.timestamp?.toDate().toLocaleDateString()} {acw.userName ? `(${acw.userName})` : ''}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${acw.timeSpent <= 30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {acw.timeSpent}s
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                        <p><strong>Motivo:</strong> {acw.inputs?.contactReason}</p>
                        <p><strong>Acción:</strong> {acw.inputs?.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
