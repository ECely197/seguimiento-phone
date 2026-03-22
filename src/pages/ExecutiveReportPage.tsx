import { auth } from '../firebaseConfig';
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';
import { getMainAgents, getRecuperoAgents } from '../api/sheetService';
import { Printer, RefreshCw, Mic, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

// ── Formatting helpers ─────────────────────────────────────────────────────────
const fmtPct = (v: any): string => {
  const s = String(v ?? '');
  if (s.includes('%')) return s;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return s || '—';
  return (n > 0 && n <= 1 ? (n * 100).toFixed(1) : n.toFixed(1)) + '%';
};
const fmtNum = (v: any): string => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? String(v ?? '—') : n.toFixed(1);
};
const asNum = (v: any): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n <= 1 && n > 0 ? n * 100 : n;
};
const shortEmail = (e: string) => e?.split('@')[0] ?? e;
const now = new Date();
const timestamp = now.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
  + ' ' + now.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });

// ── Types ─────────────────────────────────────────────────────────────────────
type AreaFilter = 'ALL' | 'phone' | 'recupero';

interface AgentRow { correo: string; lob: string; [k: string]: any; }
interface QuizResult { id: string; agentEmail: string; quizId: string; quizType: string; isCorrect: boolean | null; answerAudioUrl?: string; timestamp: any; reviewStatus?: 'pending' | 'approved' | 'rejected'; }
interface QuizMeta  { id: string; situation: string; quizType: string; }
interface AcwResult { id: string; userEmail: string; scenarioTitle: string; timeSpent: number; timestamp: any; }

// ── KPI badge ────────────────────────────────────────────────────────────────
const KpiBadge = ({ val, target, fmt }: { val: any; target: number; fmt: (v:any)=>string }) => {
  const n = asNum(val);
  const ok = n >= target;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${ok ? 'text-emerald-700' : 'text-red-600'}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {fmt(val)}
    </span>
  );
};

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 border-b border-slate-200 pb-2 mb-3 mt-8 first:mt-0 print:mt-6">
    {children}
  </h2>
);

// ── Core table styles ─────────────────────────────────────────────────────────
const TH = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap';
const TD = 'px-3 py-2 text-sm text-slate-700 whitespace-nowrap';

// ═════════════════════════════════════════════════════════════════════════════
export default function ExecutiveReportPage() {
  const user = auth.currentUser;

  const [mainAgents,    setMainAgents]    = useState<AgentRow[]>([]);
  const [recuperoAgents,setRecuperoAgents]= useState<AgentRow[]>([]);
  const [quizResults,   setQuizResults]   = useState<QuizResult[]>([]);
  const [quizMeta,      setQuizMeta]      = useState<Map<string,QuizMeta>>(new Map());
  const [acwResults,    setAcwResults]    = useState<AcwResult[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<AreaFilter>('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const [main, recupero, quizSnap, quizMetaSnap, acwSnap] = await Promise.all([
        getMainAgents(),
        getRecuperoAgents(),
        fetchAllUsersSubcollection('resultados_quizzes').then(data => ({ docs: data.map((d: any) => ({ id: d.id, data: () => d })) })),
        getDocs(getPublicCollection('quizzes')),
        fetchAllUsersSubcollection('acw_attempts').then(data => ({ docs: data.map((d: any) => ({ id: d.id, data: () => d })) })),
      ]);

      // Both come from the primary sheet — tag them all as 'phone' for now; B2X agents
      // can be distinguished if your sheet has a LOB column (raw.lob / raw.LOB / raw.A).
      const rawRows: AgentRow[] = main.map((a: any) => ({
        ...a,
        lob: (a.lob ?? a.LOB ?? a.area ?? 'phone').toString().toLowerCase(),
      }));
      // Explicitly remove B2X agents if they exist in the sheet
      const mainRows = rawRows.filter(a => a.lob !== 'b2x');

      const recRows: AgentRow[] = recupero.map((a: any) => ({ ...a, lob: 'recupero' }));

      setMainAgents(mainRows);
      setRecuperoAgents(recRows);

      setQuizResults(
        quizSnap.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))
          .sort((a,b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))
      );

      const metaMap = new Map<string, QuizMeta>();
      quizMetaSnap.docs.forEach(d => {
        const qd = d.data();
        metaMap.set(d.id, { id: d.id, situation: qd.situation ?? qd.title ?? d.id, quizType: qd.quizType ?? 'multiple-choice' });
      });
      setQuizMeta(metaMap);

      setAcwResults(
        acwSnap.docs.map(d => ({ id: d.id, ...d.data() } as AcwResult))
          .sort((a,b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))
      );
    } catch (err) {
      console.error('[ExecutiveReport] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Filtered agents ──────────────────────────────────────────────────────
  const allAgents = [...mainAgents, ...recuperoAgents];
  const filtered  = filter === 'ALL' ? allAgents : allAgents.filter(a => a.lob === filter);

  // ── Filtered quiz / ACW results ──────────────────────────────────────────
  const filteredEmails = new Set(filtered.map(a => a.correo?.toLowerCase()));
  const filteredQuiz   = filter === 'ALL' ? quizResults : quizResults.filter(r => filteredEmails.has(r.agentEmail?.toLowerCase()));
  const filteredAcw    = filter === 'ALL' ? acwResults  : acwResults.filter(r => filteredEmails.has(r.userEmail?.toLowerCase()));

  const FILTERS: { key: AreaFilter; label: string }[] = [
    { key: 'ALL',      label: 'Todos' },
    { key: 'phone',    label: 'Phone' },
    { key: 'recupero', label: 'Recupero' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* ── Top bar ── */}
      <div className="bg-[#0a2540] text-white px-6 py-5 no-print">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-1">PedidosYa · Dashboard</p>
            <h1 className="text-2xl font-bold leading-tight">Reporte de Desempeño Operativo</h1>
          </div>
          <div className="flex gap-2 flex-shrink-0 mt-1">
            <a
              href="/executive-report/hourly-trends"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              <TrendingUp size={14} /> Evolutivos
            </a>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Print-only header ── */}
      <div className="hidden print:block px-6 py-4 border-b border-slate-200">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">PedidosYa · Dashboard Ejecutivo</p>
        <h1 className="text-xl font-bold">Reporte de Desempeño Operativo — Equipo Edwin</h1>
        <p className="text-xs text-slate-500">Generado: {timestamp}</p>
      </div>

      {/* ── Filter bar ── */}
      <div className="max-w-6xl mx-auto px-6 py-4 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 mr-1">Filtrar por área:</span>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-[#0a2540] text-white border-[#0a2540]'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-6 pb-16 print:px-0">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando datos…</p>
          </div>
        ) : (
          <>
            {/* ══ SECTION A: Team KPIs ══════════════════════════════════════════ */}
            <SectionHeader>A · Métricas Generales del Equipo</SectionHeader>

            {/* Phone table */}
            {(filter === 'ALL' || filter === 'phone') && mainAgents.filter(a => filter === 'ALL' || a.lob === filter).length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {['Agente', 'Área', 'AHT', 'RES', 'PSAT', 'No Contestada'].map(h => (
                          <th key={h} className={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mainAgents
                        .filter(a => filter === 'ALL' || a.lob === filter)
                        .map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className={TD + ' font-medium'}>{shortEmail(a.correo)}</td>
                          <td className={TD}>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-100 text-blue-700`}>
                              {a.lob}
                            </span>
                          </td>
                          <td className={TD}>{fmtNum(a['AHT Real'])}</td>
                          <td className={TD}><KpiBadge val={a.RES}  target={92} fmt={fmtPct} /></td>
                          <td className={TD}><KpiBadge val={a.PSAT} target={93} fmt={fmtPct} /></td>
                          <td className={TD}>{fmtPct(a['No contestada'])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recupero table */}
            {(filter === 'ALL' || filter === 'recupero') && recuperoAgents.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Recupero</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {['Agente', 'Tot. Llamadas', 'Efectiva', 'HS Gestionadas', 'Prod. Tot. Llamadas', 'Cuartil', 'Prod. Tot. Efectivas'].map(h => (
                          <th key={h} className={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recuperoAgents.map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className={TD + ' font-medium'}>{shortEmail(a.correo)}</td>
                          <td className={TD}>{a['Tot. Llamadas'] ?? '—'}</td>
                          <td className={TD}>{a['Efectiva'] ?? '—'}</td>
                          <td className={TD}>{a['HS Gestionadas'] ?? '—'}</td>
                          <td className={TD}>{a['Prod. Tot. Llamadas'] ?? '—'}</td>
                          <td className={TD}>{a['Cuartil1'] ?? '—'}</td>
                          <td className={TD}>{a['Prod. Tot. Efectivas'] ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Sin datos disponibles para el área seleccionada.</p>
            )}

            {/* ══ SECTION B: Quiz & Roleplay Results ═══════════════════════════ */}
            <SectionHeader>B · Resultados de Quizzes y Roleplay</SectionHeader>

            {filteredQuiz.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aún no hay resultados de quizzes.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm mb-6">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {['Agente', 'Quiz', 'Tipo', 'Resultado'].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuiz.map(r => {
                      const meta    = quizMeta.get(r.quizId);
                      const isOpen  = r.quizType === 'open-audio' || meta?.quizType === 'open-audio';
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className={TD + ' font-medium'}>{shortEmail(r.agentEmail)}</td>
                          <td className={TD + ' max-w-xs truncate'} title={meta?.situation}>
                            {meta?.situation ?? r.quizId}
                          </td>
                          <td className={TD}>
                            {isOpen ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[11px] font-bold">
                                <Mic size={10} /> Roleplay
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-bold">
                                <CheckCircle size={10} /> Quiz
                              </span>
                            )}
                          </td>
                          <td className={TD}>
                            {isOpen ? (
                              r.reviewStatus === 'approved' ? (
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle size={14} /> Aprobado
                                </span>
                              ) : r.reviewStatus === 'rejected' ? (
                                <span className="text-red-600 font-semibold flex items-center gap-1">
                                  <XCircle size={14} /> No Aprobado
                                </span>
                              ) : (
                                <span className="text-purple-600 font-medium flex items-center gap-1">
                                  <Clock size={13} /> Pendiente revisión
                                </span>
                              )
                            ) : r.isCorrect === true ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle size={14} /> Correcto
                              </span>
                            ) : (
                              <span className="text-red-600 font-semibold flex items-center gap-1">
                                <XCircle size={14} /> Incorrecto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══ SECTION C: ACW Simulator ══════════════════════════════════════ */}
            <SectionHeader>C · Resultados del Simulador ACW</SectionHeader>

            {filteredAcw.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aún no hay resultados del simulador ACW.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {['Agente', 'Escenario', 'Tiempo ACW', 'Estado'].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAcw.map(r => {
                      const secs = r.timeSpent ?? 0;
                      const acwStatus =
                        secs < 30  ? { label: 'Meta cumplida', cls: 'text-emerald-600', dot: 'bg-emerald-500' } :
                        secs < 60  ? { label: 'Aceptable',     cls: 'text-amber-600',   dot: 'bg-amber-400'  } :
                                     { label: 'Fuera de meta', cls: 'text-red-600',      dot: 'bg-red-500'    };
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className={TD + ' font-medium'}>{shortEmail(r.userEmail)}</td>
                          <td className={TD + ' max-w-xs truncate'} title={r.scenarioTitle}>
                            {r.scenarioTitle ?? '—'}
                          </td>
                          <td className={TD}>
                            <span className="flex items-center gap-1.5">
                              <Clock size={13} className="text-slate-400" />
                              {secs}s
                            </span>
                          </td>
                          <td className={TD}>
                            <span className={`flex items-center gap-1.5 font-semibold ${acwStatus.cls}`}>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${acwStatus.dot}`} />
                              {acwStatus.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
              
            </div>
          </>
        )}
      </div>

      {/* Print styles injected inline */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
