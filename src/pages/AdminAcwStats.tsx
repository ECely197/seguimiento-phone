import { auth } from '../firebaseConfig';
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';import { fetchAllUsersSubcollection } from '../firebasePaths';

import { Loader2, Users, Clock, TrendingDown, Zap, ChevronDown, ChevronUp, Building2 } from 'lucide-react';

interface AcwAttempt {
  id: string;
  userId: string;
  userEmail: string;
  scenarioId: string;
  scenarioTitle: string;
  timeSpent: number; 
  lobId?: string; // Phase 1 field
  inputs: { contactReason: string; comment: string; action: string };
  timestamp: { seconds: number };
}

const formatDate = (ts: { seconds: number } | undefined) => {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const timeBadge = (secs: number) => {
  if (secs < 30) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (secs < 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
};

export default function AdminAcwStats({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
  const [attempts, setAttempts] = useState<AcwAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetch();
  }, [globalLobFilter]);

  const fetch = async () => {
    try {
      setLoading(true);
      const allData = await fetchAllUsersSubcollection('acw_attempts');
      let sorted = allData.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      
      // Filter by LOB
      if (globalLobFilter && globalLobFilter !== 'all') {
          sorted = sorted.filter(a => (a.lobId || 'phone') === globalLobFilter);
      }

      setAttempts(sorted as unknown as AcwAttempt[]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <Loader2 className="animate-spin text-m3-primary" size={32} />
      <p className="text-[10px] font-black uppercase text-gray-400">Analizando registros ACW...</p>
    </div>
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalAttempts = attempts.length;
  const avgTime = totalAttempts > 0 ? Math.round(attempts.reduce((a, b) => a + b.timeSpent, 0) / totalAttempts) : 0;
  const under30 = attempts.filter(a => a.timeSpent < 30).length;
  const uniqueAgents = new Set(attempts.map(a => a.userId)).size;

  const agentMap: Record<string, { email: string; times: number[] }> = {};
  attempts.forEach(a => {
    if (!agentMap[a.userId]) agentMap[a.userId] = { email: a.userEmail, times: [] };
    agentMap[a.userId].times.push(a.timeSpent);
  });
  const agentStats = Object.entries(agentMap)
    .map(([uid, v]) => ({
      uid,
      email: v.email,
      avg: Math.round(v.times.reduce((a, b) => a + b, 0) / v.times.length),
      count: v.times.length,
      best: Math.min(...v.times),
    }))
    .sort((a, b) => a.avg - b.avg);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Clock, label: 'Promedio LOB', value: `${avgTime}s`, sub: 'Meta: < 30s', color: avgTime < 30 ? 'text-emerald-500' : avgTime < 60 ? 'text-amber-500' : 'text-rose-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
          { icon: Zap, label: 'Intentos en Segmento', value: totalAttempts, sub: 'Volumen total', color: 'text-m3-primary', bg: 'bg-m3-primary/5' },
          { icon: TrendingDown, label: 'Bajo Meta (30s)', value: `${totalAttempts > 0 ? Math.round((under30 / totalAttempts) * 100) : 0}%`, sub: `${under30} de ${totalAttempts}`, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
          { icon: Users, label: 'Frecuencia (Agentes)', value: uniqueAgents, sub: 'Agentes activos', color: 'text-indigo-500', bg: 'bg-indigo-50/50 dark:bg-indigo-900/10' },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-3xl p-5 border border-m3-surface-variant/20 dark:border-white/5 shadow-sm transition-all hover:shadow-md ${bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg ${bg} ring-1 ring-white/20`}>
                <Icon size={16} className={color} />
              </div>
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
            </div>
            <p className={`text-3xl font-black tracking-tighter ${color}`}>{value}</p>
            <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Agent Performance ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-m3-secondary/50 flex items-center gap-2">
                <Users size={16} /> Rankings de Velocidad
            </h3>
            <div className="bg-white dark:bg-[#1E1E1E] rounded-[32px] border border-m3-surface-variant/30 dark:border-white/10 overflow-hidden shadow-sm">
                <table className="w-full text-xs font-bold">
                <thead>
                    <tr className="bg-m3-surface-variant/10 dark:bg-white/5 text-[9px] uppercase tracking-widest text-gray-400">
                    <th className="text-left px-5 py-4">Agente</th>
                    <th className="text-center px-4 py-4">Vol.</th>
                    <th className="text-center px-4 py-4">Prom.</th>
                    <th className="text-center px-4 py-4">TOP</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
                    {agentStats.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay datos para este grupo</td></tr>
                    ) : agentStats.map((agent, i) => (
                    <tr key={agent.uid} className="hover:bg-m3-primary/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {i + 1}
                                </span>
                                <span className="truncate max-w-[140px] text-m3-secondary dark:text-m3-on-surface-dark">{agent.email}</span>
                            </div>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-400">{agent.count}</td>
                        <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[10px] ${timeBadge(agent.avg)} animate-in zoom-in duration-300`}>{agent.avg}s</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                        <span className="text-m3-primary">{agent.best}s</span>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>

          {/* ── Attempts Timeline ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-m3-secondary/50 flex items-center gap-2">
                <Clock size={16} /> Log de Prácticas
            </h3>
            <div className="bg-white dark:bg-[#1E1E1E] rounded-[32px] border border-m3-surface-variant/30 dark:border-white/10 overflow-hidden shadow-sm">
                <table className="w-full text-xs font-bold">
                    <thead>
                    <tr className="bg-m3-surface-variant/10 dark:bg-white/5 text-[9px] uppercase tracking-widest text-gray-400">
                        <th className="text-left px-5 py-4">Usuario</th>
                        <th className="text-center px-4 py-4">Tiempo</th>
                        <th className="text-right px-4 py-4">Fecha</th>
                        <th className="w-8"></th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
                    {attempts.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Sin actividad reciente</td></tr>
                    ) : attempts.map(a => (
                        <>
                        <tr key={a.id} className="hover:bg-m3-primary/5 dark:hover:bg-white/5 transition-all cursor-pointer group" onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}>
                            <td className="px-5 py-4">
                            <p className="text-m3-secondary dark:text-m3-on-surface-dark truncate max-w-[140px]">{a.userEmail}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase truncate max-w-[140px]">{a.scenarioTitle}</p>
                            </td>
                            <td className="px-4 py-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-[10px] ${timeBadge(a.timeSpent)}`}>{a.timeSpent}s</span>
                            </td>
                            <td className="px-4 py-4 text-right text-[9px] text-gray-500 group-hover:text-m3-primary transition-colors">{formatDate(a.timestamp)}</td>
                            <td className="px-4 py-4 text-right">
                            {expandedRow === a.id ? <ChevronUp size={16} className="text-m3-primary" /> : <ChevronDown size={16} className="text-gray-300" />}
                            </td>
                        </tr>
                        {expandedRow === a.id && (
                            <tr key={`${a.id}-expanded`} className="bg-m3-surface-variant/10 dark:bg-black/20 animate-in slide-in-from-top-1 duration-200">
                            <td colSpan={4} className="px-5 py-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-gray-600 dark:text-gray-400">
                                    <div className="bg-white dark:bg-[#121212] p-3 rounded-2xl border border-m3-surface-variant/20 shadow-sm">
                                        <p className="uppercase font-black text-m3-primary mb-1">Motivo Contacto</p>
                                        <p className="italic font-bold">"{a.inputs?.contactReason || 'Sin registro'}"</p>
                                    </div>
                                    <div className="bg-white dark:bg-[#121212] p-3 rounded-2xl border border-m3-surface-variant/20 shadow-sm">
                                        <p className="uppercase font-black text-indigo-500 mb-1">Acción Realizada</p>
                                        <p className="italic font-bold">"{a.inputs?.action || 'Sin registro'}"</p>
                                    </div>
                                </div>
                            </td>
                            </tr>
                        )}
                        </>
                    ))}
                    </tbody>
                </table>
            </div>
          </div>
      </div>
    </div>
  );
}
