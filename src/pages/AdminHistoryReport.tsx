import { useState, useEffect } from 'react';
import { 
  BarChart3, Search, Loader2, ChevronRight, Download, 
  Clock, Zap, Edit3, Smile, TrendingUp, CheckSquare, ClipboardList 
} from 'lucide-react';
import { getMainAgents, getB2xAgents, getAgentHistory } from '../api/sheetService';
import type { AgentHistory } from '../api/sheetService';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

interface Agent {
  correo: string;
  agente?: string;
  name?: string;
  lob: 'phone' | 'b2x';
}

export default function AdminHistoryReport() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [historyData, setHistoryData] = useState<AgentHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chartMetric, setChartMetric] = useState<'aht' | 'frt' | 'acw' | 'psat'>('aht');

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      fetchHistory(selectedAgent.correo);
    }
  }, [selectedAgent]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const [phone, b2x] = await Promise.all([
        getMainAgents(),
        getB2xAgents()
      ]);
      
      const combined: Agent[] = [
        ...phone.map(a => ({ ...a, lob: 'phone' as const })),
        ...b2x.map(a => ({ ...a, lob: 'b2x' as const }))
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
      const history = await getAgentHistory(email);
      setHistoryData(history);
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

  const filteredAgents = agents.filter(a => 
    (a.correo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.agente || a.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-m3-surface-variant dark:border-white/10 bg-m3-surface dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto rounded-3xl border border-m3-surface-variant/30 dark:border-white/10 bg-white dark:bg-[#1E1E1E] shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-m3-primary" />
            </div>
          ) : (
            <div className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
              {filteredAgents.map(agent => (
                <button
                  key={agent.correo}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-all text-left
                    ${selectedAgent?.correo === agent.correo ? 'bg-m3-primary/10 dark:bg-m3-primary/20' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark truncate">
                      {agent.agente || agent.name || 'Sin nombre'}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{agent.correo}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block
                      ${agent.lob === 'b2x' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {agent.lob.toUpperCase()}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Area: Charts & Details */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
            <BarChart3 size={64} className="mb-4" />
            <h3 className="text-xl font-bold">Auditoría Histórica</h3>
            <p className="text-sm">Selecciona un agente para ver su rendimiento diario.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Agent Header */}
            <div className="flex items-center justify-between bg-m3-primary/5 dark:bg-white/5 border border-m3-primary/10 dark:border-white/10 p-6 rounded-3xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-m3-primary/10 flex items-center justify-center text-xl font-bold text-m3-primary">
                  {(selectedAgent.agente || selectedAgent.name || '?').charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">
                    {selectedAgent.agente || selectedAgent.name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedAgent.correo}</p>
                </div>
              </div>
              <button 
                onClick={handleExport}
                disabled={!historyData}
                className="flex items-center gap-2 px-4 py-2 bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 rounded-xl text-sm font-bold hover:bg-m3-primary/10 transition-all disabled:opacity-50"
              >
                <Download size={18} />
                Exportar Resumen
              </button>
            </div>

            {historyLoading ? (
              <div className="flex-1 flex items-center justify-center py-32">
                <Loader2 className="animate-spin text-m3-primary" size={48} />
              </div>
            ) : !historyData ? (
              <div className="text-center py-32 text-gray-400">
                No hay datos históricos disponibles para este agente.
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* ── Monthly Impact Section ────────────────────────────────────────── */}
                <section>
                  <h2 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-5 flex items-center gap-2">
                    <TrendingUp size={22} className="text-m3-primary" />
                    Impacto Mensual del Agente
                  </h2>
                  
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
                        <MonthlyImpactCard 
                          label="Promedio AHT" 
                          value={avg.aht.toFixed(1)} 
                          unit="seg" 
                          icon={Clock} 
                          status={avg.aht < 280 ? 'green' : avg.aht < 320 ? 'yellow' : 'red'}
                          colorClass={{ bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' }} 
                        />
                        <MonthlyImpactCard 
                          label="Promedio FRT" 
                          value={avg.frt.toFixed(1)} 
                          unit="seg" 
                          icon={Zap} 
                          status={avg.frt < 60 ? 'green' : avg.frt < 90 ? 'yellow' : 'red'}
                          colorClass={{ bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' }} 
                        />
                        <MonthlyImpactCard 
                          label="Promedio ACW" 
                          value={avg.acw.toFixed(1)} 
                          unit="seg" 
                          icon={Edit3} 
                          status={avg.acw < 20 ? 'green' : avg.acw < 40 ? 'yellow' : 'red'}
                          colorClass={{ bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' }} 
                        />
                        <MonthlyImpactCard 
                          label="SAT Mensual" 
                          value={avg.psat.toFixed(1)} 
                          unit="%" 
                          icon={Smile} 
                          status={avg.psat > 85 ? 'green' : avg.psat > 75 ? 'yellow' : 'red'}
                          colorClass={{ bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' }} 
                        />
                        <MonthlyImpactCard 
                          label="Calidad (KPI 5)" 
                          value={avg.kpi5.toFixed(1)} 
                          unit="%" 
                          icon={CheckSquare} 
                          status={avg.kpi5 > 90 ? 'green' : avg.kpi5 > 80 ? 'yellow' : 'red'}
                          colorClass={{ bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' }} 
                        />
                      </div>
                    );
                  })()}
                </section>

                {/* Trend Chart Box */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-8 border border-m3-surface-variant/30 dark:border-white/10 shadow-sm relative">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-m3-primary/10 rounded-xl">
                        <TrendingUp size={20} className="text-m3-primary" />
                      </div>
                      <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark">Rendimiento Mensual</h4>
                    </div>

                    <div className="flex p-1 bg-m3-surface-variant/20 dark:bg-white/5 rounded-xl">
                      {['aht', 'frt', 'acw', 'psat'].map((m) => (
                        <button 
                          key={m}
                          onClick={() => setChartMetric(m as any)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${chartMetric === m ? 'bg-white dark:bg-m3-primary text-m3-primary dark:text-white shadow-sm' : 'text-m3-secondary/60 dark:hover:text-m3-primary'}`}
                        >
                          {m}
                        </button>
                      ))}
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
                        ...(history[dateStr] || { aht: null, frt: null, acw: null, psat: null, kpi5: null })
                      };
                    });

                    // Find last day with data for highlighting
                    let lastDayWithData = '';
                    monthArray.forEach(row => {
                      if (history[row.fullDate]) lastDayWithData = row.fullDate;
                    });

                    return (
                      <>
                        <div className="h-80 w-full mb-12">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthArray}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888888'}} />
                              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                              <Line 
                                type="monotone" 
                                dataKey={chartMetric} 
                                stroke={chartMetric === 'aht' ? '#3B82F6' : chartMetric === 'frt' ? '#EAB308' : chartMetric === 'acw' ? '#A855F7' : '#10B981'} 
                                strokeWidth={3} 
                                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} 
                                activeDot={{ r: 5 }} 
                                connectNulls={true}
                                animationDuration={1000} 
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Auditing Table */}
                        <div className="mt-8 pt-8 border-t border-m3-surface-variant/20 dark:border-white/5">
                          <h4 className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-4 flex items-center gap-2">
                             <ClipboardList size={16} /> Detalle del Historial
                          </h4>
                          <div className="rounded-2xl border border-m3-surface-variant/30 bg-m3-surface/30 dark:bg-black/10 overflow-hidden">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-m3-surface-variant/10 dark:bg-white/5 text-gray-500 font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="px-4 py-3">Día</th>
                                  <th className="px-4 py-3 text-center">AHT</th>
                                  <th className="px-4 py-3 text-center">FRT</th>
                                  <th className="px-4 py-3 text-center">ACW</th>
                                  <th className="px-4 py-3 text-center">PSAT</th>
                                  <th className="px-4 py-3 text-center">KPI 5</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
                                {monthArray.map((row) => {
                                  const isLastDataRow = !history[today] && row.fullDate === lastDayWithData;
                                  const rowData = history[row.fullDate] as any;
                                  
                                  return (
                                    <tr 
                                      key={row.fullDate}
                                      className={`transition-colors 
                                        ${row.fullDate === today ? 'bg-m3-primary/10 dark:bg-m3-primary/20 font-bold' : ''}
                                        ${isLastDataRow ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                                        ${!rowData ? 'opacity-20' : 'hover:bg-m3-surface-variant/5 dark:hover:bg-white/5'}
                                      `}
                                    >
                                      <td className="px-4 py-2 font-medium">
                                        {row.day}
                                        {row.fullDate === today && <span className="ml-2 text-[8px] bg-m3-primary text-white px-1 rounded">Hoy</span>}
                                        {isLastDataRow && <span className="ml-2 text-[8px] bg-yellow-500 text-white px-1 rounded">Cierre</span>}
                                      </td>
                                      <td className="px-4 py-2 text-center">{rowData ? fmtNum(rowData.aht) : '—'}</td>
                                      <td className="px-4 py-2 text-center">{rowData ? fmtNum(rowData.frt) : '—'}</td>
                                      <td className="px-4 py-2 text-center">{rowData ? fmtNum(rowData.acw) : '—'}</td>
                                      <td className="px-4 py-2 text-center">{rowData ? fmtPct(rowData.psat) : '—'}</td>
                                      <td className="px-4 py-2 text-center">{rowData ? fmtPct(rowData.kpi5) : '—'}</td>
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
        ) as any}
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

function MetricSummaryCard({ label, value, icon: Icon, color, isPct }: { label: string; value: any; icon: any; color: string; isPct?: boolean }) {
  const formattedValue = isPct 
    ? (String(value).includes('%') ? value : `${(parseFloat(value) * (parseFloat(value) <= 1 ? 100 : 1)).toFixed(1)}%`)
    : (parseFloat(value) || value || '—');

  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-m3-surface-variant/30 dark:border-white/10 p-4 rounded-2xl flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{label}</p>
        <p className="text-xl font-extrabold text-m3-secondary dark:text-m3-on-surface-dark">{formattedValue}</p>
      </div>
    </div>
  );
}
