import { useState, useEffect } from 'react';
import { 
  BarChart3, Search, Loader2, ChevronRight, Download, 
  Clock, Zap, Edit3, Smile, TrendingUp, CheckSquare, ClipboardList, Filter
} from 'lucide-react';
import { getPublicDoc } from '../firebasePaths';
import { getDoc } from 'firebase/firestore';
import { getMainAgents, getRecuperoAgents, getB2xAgents, getAgentHistory } from '../api/sheetService';
import type { AgentHistory } from '../api/sheetService';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

interface Agent {
  correo: string;
  agente?: string;
  name?: string;
  lob: string;
}

export default function AdminHistoryReport({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [historyData, setHistoryData] = useState<AgentHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historicalKpis, setHistoricalKpis] = useState<string[]>([]);
  const [activeGraphKpi, setActiveGraphKpi] = useState<string>('');
  const [lobConfig, setLobConfig] = useState<any | null>(null);

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        // 1. Resolve LOB Config if filtered
        if (globalLobFilter && globalLobFilter !== 'all') {
            try {
                const snap = await getDoc(getPublicDoc('lobs', globalLobFilter));
                if (snap.exists()) setLobConfig(snap.data());
                else setLobConfig(null);
            } catch (e) { console.error("Error fetching LOB doc:", e); }
        } else {
            setLobConfig(null);
        }
        // 2. Load Agents
        await loadAgents();
    };
    init();
  }, [globalLobFilter]); 

  useEffect(() => {
    if (selectedAgent) {
      fetchHistory(selectedAgent.correo);
    }
  }, [selectedAgent]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      // Parallel fetch from all known sources
      const [phone, recupero, b2x] = await Promise.all([
        getMainAgents(),
        getRecuperoAgents(),
        getB2xAgents()
      ]);
      
      const combined: Agent[] = [
        ...phone.map(a => ({ ...a, lob: 'phone' })),
        ...recupero.map(a => ({ ...a, lob: 'recupero' })),
        ...b2x.map(a => ({ ...a, lob: 'b2x' }))
      ];
      
      // Filter duplicates by email
      const seen = new Set();
      const unique = combined.filter(a => {
        const email = (a.correo || '').toLowerCase();
        if (seen.has(email)) return false;
        seen.add(email);
        return true;
      });

      setAgents(unique);
    } catch (error) {
      console.error('[AdminHistoryReport] Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (email: string) => {
    setHistoryLoading(true);
    try {
      // Priority: LOB Config dynamic URL -> Environment Fallback
      const dynamicHistoryUrl = lobConfig?.historicalMetricsUrl;
      const history = await getAgentHistory(email, dynamicHistoryUrl);
      setHistoryData(history);
      
      const agentHistory = history?.history || {};
      const firstValidDate = Object.keys(agentHistory).find(date => Object.keys(agentHistory[date]).length > 0);
      const detectedKpis = firstValidDate ? Object.keys(agentHistory[firstValidDate]).filter(k => k.toLowerCase() !== 'fecha' && k.toLowerCase() !== 'date') : [];
      setHistoricalKpis(detectedKpis);
      if (detectedKpis.length > 0) setActiveGraphKpi(detectedKpis[0]);
    } catch (error) {
      console.error('[AdminHistoryReport] Error fetching history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExport = () => {
    if (!historyData || !selectedAgent) return;
    
    const history = historyData.history;
    const dates = Object.keys(history).sort((a, b) => a.localeCompare(b));
    
    let csv = 'Fecha,AHT,FRT,ACW,PSAT\n';
    dates.forEach(date => {
      const d = history[date];
      csv += `${date},${d.aht},${d.frt},${d.acw},${d.psat}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `historial_${selectedAgent.correo}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Integrated Filtering ───────────────────────────────────────────────────
  const filteredAgents = agents.filter(a => {
    // 1. Term Filter
    const term = searchTerm.toLowerCase();
    const matchesSearch = (a.correo || '').toLowerCase().includes(term) ||
                          (a.agente || a.name || '').toLowerCase().includes(term);
    if (!matchesSearch) return false;

    // 2. Global LOB Filter
    if (globalLobFilter && globalLobFilter !== 'all') {
      return a.lob === globalLobFilter;
    }

    return true;
  });

  return (
    <div className="flex h-[calc(100vh-200px)] gap-6 animate-in fade-in duration-500">
      
      {/* Sidebar: Agent List */}
      <div className="w-80 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar agente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-m3-surface-variant dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none shadow-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto rounded-[32px] border border-m3-surface-variant/30 dark:border-white/10 bg-white dark:bg-[#1E1E1E] shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="animate-spin text-m3-primary" />
              <p className="text-[10px] font-bold uppercase text-gray-400">Cargando Directorio...</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs italic">
                {globalLobFilter !== 'all' ? `No hay agentes en ${globalLobFilter}` : 'No se encontraron agentes.'}
            </div>
          ) : (
            <div className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
              {filteredAgents.map(agent => (
                <button
                  key={agent.correo}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-m3-primary/5 dark:hover:bg-white/5 transition-all text-left group
                    ${selectedAgent?.correo === agent.correo ? 'bg-m3-primary/10 dark:bg-m3-primary/20' : ''}`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-m3-primary/10 dark:bg-m3-primary-dark/20 flex items-center justify-center text-m3-primary font-black text-xs flex-shrink-0 group-hover:scale-110 transition-transform">
                        {(agent.agente || agent.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark truncate leading-tight">
                        {agent.agente || agent.name || 'Sin nombre'}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{agent.correo}</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block shadow-sm
                        ${agent.lob === 'b2x' ? 'bg-green-100 text-green-700' : 
                          agent.lob === 'recupero' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {agent.lob}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-m3-primary transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Area: Charts & Details */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-white/[0.02] rounded-[48px] border-2 border-dashed border-gray-100 dark:border-white/5">
            <div className="p-8 bg-white dark:bg-[#2C2C2C] rounded-full shadow-lg mb-6 ring-4 ring-m3-primary/10 animate-pulse">
                <BarChart3 size={64} className="text-m3-primary" />
            </div>
            <h3 className="text-2xl font-black text-m3-secondary dark:text-white">Auditoría Operativa</h3>
            <p className="text-sm text-gray-500 max-w-xs mt-2">Selecciona un agente de la lista para visualizar su tendencia histórica de métricas.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            {/* Agent Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-[#1E1E1E] border border-m3-surface-variant/40 dark:border-white/10 p-6 rounded-[32px] shadow-sm">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-m3-primary to-blue-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                  {(selectedAgent.agente || selectedAgent.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-m3-secondary dark:text-white leading-tight">
                    {selectedAgent.agente || selectedAgent.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm font-medium text-gray-500">{selectedAgent.correo}</p>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-m3-primary">{selectedAgent.lob}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleExport}
                disabled={!historyData}
                className="mt-4 md:mt-0 flex items-center justify-center gap-2 px-6 py-3 bg-m3-primary text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-m3-primary/90 transition-all shadow-lg hover:shadow-m3-primary/30 disabled:opacity-50"
              >
                <Download size={18} />
                Exportar CSV
              </button>
            </div>

            {historyLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="animate-spin text-m3-primary" size={48} />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Consultando B2X Cloud Database...</p>
              </div>
            ) : !historyData ? (
              <div className="bg-red-50 dark:bg-red-900/10 p-12 text-center rounded-[32px] border border-red-100 dark:border-red-900/30">
                <p className="text-red-600 dark:text-red-400 font-bold">No hay registros históricos para este correo en el sistema.</p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* ── Monthly Average Cards ────────────────────────────────────────── */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-m3-primary/10 rounded-xl">
                      <TrendingUp size={20} className="text-m3-primary" />
                    </div>
                    <h2 className="text-lg font-black text-m3-secondary dark:text-white uppercase tracking-tight">
                      Acumulados Mensuales
                    </h2>
                  </div>
                  
                  {(() => {
                    const history = historyData.history;
                    const values = Object.values(history);
                    const parse = (v: any) => {
                      if (v === null || v === undefined) return null;
                      const val = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
                      if (isNaN(val)) return null;
                      return val > 0 && val <= 1 && !String(v).includes('%') ? val * 100 : val;
                    };
                    const getAvg = (key: string) => {
                      const valid = values.map(v => parse((v as any)[key])).filter(v => v !== null) as number[];
                      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
                    };

                    const avg = {
                      aht: getAvg('aht'),
                      frt: getAvg('frt'),
                      acw: getAvg('acw'),
                      psat: getAvg('psat'),
                      kpi5: getAvg('kpi5')
                    };

                    return (
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <MonthlyImpactCard label="AHT" value={avg.aht.toFixed(1)} unit="seg" icon={Clock} status={avg.aht < 280 ? 'green' : avg.aht < 320 ? 'yellow' : 'red'} colorClass={{ bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' }} />
                        <MonthlyImpactCard label="FRT" value={avg.frt.toFixed(1)} unit="seg" icon={Zap} status={avg.frt < 60 ? 'green' : avg.frt < 90 ? 'yellow' : 'red'} colorClass={{ bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' }} />
                        <MonthlyImpactCard label="ACW" value={avg.acw.toFixed(1)} unit="seg" icon={Edit3} status={avg.acw < 20 ? 'green' : avg.acw < 40 ? 'yellow' : 'red'} colorClass={{ bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' }} />
                        <MonthlyImpactCard label="SAT" value={avg.psat.toFixed(1)} unit="%" icon={Smile} status={avg.psat > 85 ? 'green' : avg.psat > 75 ? 'yellow' : 'red'} colorClass={{ bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' }} />
                        <MonthlyImpactCard label="QA" value={avg.kpi5.toFixed(1)} unit="%" icon={CheckSquare} status={avg.kpi5 > 90 ? 'green' : avg.kpi5 > 80 ? 'yellow' : 'red'} colorClass={{ bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' }} />
                      </div>
                    );
                  })()}
                </section>

                {/* Trend Chart Box */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-[40px] p-8 border border-m3-surface-variant/40 dark:border-white/10 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-m3-primary/10 rounded-2xl ring-4 ring-m3-primary/5">
                        <TrendingUp size={22} className="text-m3-primary" />
                      </div>
                      <div>
                        <h4 className="font-black text-m3-secondary dark:text-white uppercase tracking-tight">Gráfica de Tendencia</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Evolución Diaria del Agente</p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const history = historyData.history;
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    
                    const monthArray = Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      return {
                        day: day,
                        date: `${day}/${month + 1}`,
                        fullDate: dateStr,
                        ...(history[dateStr] || {})
                      };
                    });

                    // Find last day with data for highlighting
                    let lastDayWithData = '';
                    monthArray.forEach(row => { if (history[row.fullDate]) lastDayWithData = row.fullDate; });

                    return (
                      <>
                        {historicalKpis.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-6">
                            {historicalKpis.map(kpi => (
                              <button
                                key={`btn-${kpi}`}
                                onClick={() => setActiveGraphKpi(kpi)}
                                className={`px-4 py-1.5 rounded-[12px] text-xs font-black uppercase tracking-widest transition-all ${
                                  activeGraphKpi === kpi 
                                    ? 'bg-m3-primary text-white shadow-lg scale-105' 
                                    : 'bg-m3-surface-variant/50 text-m3-on-surface-variant hover:bg-m3-primary hover:text-white dark:bg-white/5 dark:text-gray-400 dark:hover:bg-m3-primary dark:hover:text-white'
                                }`}
                              >
                                {kpi.replace(/_/g, ' ')}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="h-96 w-full mb-12">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthArray}>
                              <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#88888815" />
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888', fontWeight: 'bold'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888', fontWeight: 'bold'}} />
                              <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontSize: '11px', fontWeight: 'bold', background: '#1E1E1E', color: '#fff' }} />
                              
                              {activeGraphKpi && (
                                <Line 
                                  type="monotone" 
                                  dataKey={activeGraphKpi} 
                                  name={activeGraphKpi.toUpperCase().replace(/_/g, ' ')} 
                                  stroke="#3b82f6" 
                                  strokeWidth={4} 
                                  dot={{ r: 4, strokeWidth: 3, fill: '#fff', stroke: '#3b82f6' }} 
                                  activeDot={{ r: 7, fill: '#3b82f6', strokeWidth: 0 }} 
                                  connectNulls 
                                  animationDuration={1500}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Detailed Data Table */}
                        <div className="mt-12 pt-10 border-t border-m3-surface-variant/20 dark:border-white/5">
                          <div className="flex items-center gap-2 mb-6">
                             <ClipboardList size={18} className="text-gray-400" />
                             <h4 className="text-xs font-black text-m3-secondary dark:text-white uppercase tracking-widest">Registros de Auditoría</h4>
                          </div>
                          <div className="rounded-[28px] border border-m3-surface-variant/30 dark:border-white/10 bg-m3-surface/30 dark:bg-black/20 overflow-hidden shadow-inner">
                            <table className="w-full text-left text-[10px] font-bold">
                              <thead className="bg-m3-surface-variant/20 dark:bg-white/5 text-gray-500 uppercase tracking-widest">
                                <tr>
                                  <th className="px-5 py-4">Calendario</th>
                                  {historicalKpis.map(kpi => (
                                    <th key={kpi} className="px-5 py-4 text-center">{kpi.replace(/_/g, ' ')}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
                                {monthArray.filter(r => !!history[r.fullDate]).map((row) => {
                                  const rowData = history[row.fullDate] as any;
                                  return (
                                    <tr 
                                      key={row.fullDate}
                                      className={`transition-colors hover:bg-m3-primary/5 dark:hover:bg-white/5
                                        ${row.fullDate === today ? 'bg-m3-primary/5 font-black text-m3-primary' : ''}
                                      `}
                                    >
                                      <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-m3-primary/30" />
                                            {row.day} de {now.toLocaleString('es-ES', { month: 'long' })}
                                        </div>
                                      </td>
                                      {historicalKpis.map(kpi => {
                                        const val = (row as any)[kpi];
                                        const formattedVal = (val !== undefined && val !== null && val !== '') 
                                            ? (typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : (!isNaN(Number(val)) && String(val).includes('.') ? Number(val).toFixed(1) : val))
                                            : '—';
                                            
                                        return (
                                          <td key={`${row.fullDate}-${kpi}`} className="px-5 py-3 text-center">
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
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtNum(v: any) {
  const n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? '—' : n.toFixed(1);
}

function fmtPct(v: any) {
  const s = String(v || '');
  if (s.includes('%')) return s;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return '—';
  return (n > 0 && n <= 1 ? (n * 100).toFixed(1) : n.toFixed(1)) + '%';
}

function MonthlyImpactCard({ label, value, unit, icon: Icon, colorClass, status }: any) {
  const statusColors: any = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-rose-500', gray: 'bg-gray-300' };
  return (
    <div className="group relative bg-white dark:bg-[#1E1E1E] rounded-[24px] p-5 shadow-sm border border-m3-surface-variant/40 dark:border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden ring-1 ring-black/5">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColors[status] || statusColors.gray}`} />
      <div className={`w-10 h-10 rounded-xl ${colorClass.bg} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
        <Icon size={20} className={colorClass.text} />
      </div>
      <div>
        <h4 className="text-[9px] font-black uppercase tracking-widest text-m3-secondary/40 dark:text-gray-500 mb-1">{label}</h4>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-m3-primary dark:text-m3-primary-dark tracking-tighter">{value}</span>
          <span className="text-[9px] font-black text-gray-400 uppercase">{unit}</span>
        </div>
      </div>
    </div>
  );
}
