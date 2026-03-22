import { auth } from '../firebaseConfig';
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Loader2, Users, Clock, TrendingDown, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface AcwAttempt {
  id: string;
  userId: string;
  userEmail: string;
  scenarioId: string;
  scenarioTitle: string;
  timeSpent: number; // seconds
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
  if (secs < 30) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (secs < 60) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
};

export default function AdminAcwStats() {
  const user = auth.currentUser;

  const [attempts, setAttempts] = useState<AcwAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const allData = await fetchAllUsersSubcollection('acw_attempts');
        let sorted = allData.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setAttempts(sorted as unknown as AcwAttempt[]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-m3-primary" size={32} /></div>;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalAttempts = attempts.length;
  const avgTime = totalAttempts > 0 ? Math.round(attempts.reduce((a, b) => a + b.timeSpent, 0) / totalAttempts) : 0;
  const under30 = attempts.filter(a => a.timeSpent < 30).length;
  const uniqueAgents = new Set(attempts.map(a => a.userId)).size;

  // Per-agent averages for performance table
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
    <div className="space-y-8">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Clock, label: 'Promedio del Equipo', value: `${avgTime}s`, sub: 'meta: < 30s', color: avgTime < 30 ? 'text-green-600 dark:text-green-400' : avgTime < 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400' },
          { icon: Zap, label: 'Intentos Totales', value: totalAttempts, sub: 'todos los agentes', color: 'text-m3-primary dark:text-m3-primary-dark' },
          { icon: TrendingDown, label: 'Bajo 30 segundos', value: `${totalAttempts > 0 ? Math.round((under30 / totalAttempts) * 100) : 0}%`, sub: `${under30} de ${totalAttempts}`, color: 'text-green-600 dark:text-green-400' },
          { icon: Users, label: 'Agentes Activos', value: uniqueAgents, sub: 'al menos 1 intento', color: 'text-purple-600 dark:text-purple-400' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={color} />
              <span className="text-xs text-gray-400 font-medium">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Agent Performance ── */}
      {agentStats.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Rendimiento por Agente</h3>
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 text-xs uppercase tracking-wide text-gray-400">
                  <th className="text-left px-4 py-3">Agente</th>
                  <th className="text-center px-4 py-3">Intentos</th>
                  <th className="text-center px-4 py-3">Promedio</th>
                  <th className="text-center px-4 py-3">Mejor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {agentStats.map((agent, i) => (
                  <tr key={agent.uid} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-5">#{i + 1}</span>
                        <span className="text-m3-secondary dark:text-m3-on-surface-dark font-medium truncate max-w-[180px]">{agent.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{agent.count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${timeBadge(agent.avg)}`}>{agent.avg}s</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${timeBadge(agent.best)}`}>{agent.best}s</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Attempts Timeline ── */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Historial de Intentos</h3>
        {attempts.length === 0
          ? (
            <div className="text-center py-16 text-gray-400">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p>Sin intentos aún. Los agentes deben completar el simulador primero.</p>
            </div>
          )
          : (
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/5 text-xs uppercase tracking-wide text-gray-400">
                    <th className="text-left px-4 py-3">Agente</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Escenario</th>
                    <th className="text-center px-4 py-3">Tiempo</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {attempts.map(a => (
                    <>
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-m3-secondary dark:text-m3-on-surface-dark truncate max-w-[140px]">{a.userEmail}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 dark:text-gray-400">{a.scenarioTitle}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${timeBadge(a.timeSpent)}`}>{a.timeSpent}s</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400 hidden md:table-cell">{formatDate(a.timestamp)}</td>
                        <td className="px-4 py-3 text-right">
                          {expandedRow === a.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </td>
                      </tr>
                      {expandedRow === a.id && (
                        <tr key={`${a.id}-expanded`} className="bg-gray-50 dark:bg-white/5">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="text-xs space-y-1 text-gray-500 dark:text-gray-400">
                              <p><span className="font-semibold">Motivo:</span> {a.inputs?.contactReason || '—'}</p>
                              <p><span className="font-semibold">Acción:</span> {a.inputs?.action || '—'}</p>
                              <p><span className="font-semibold">Comentario:</span> {a.inputs?.comment || '—'}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}
