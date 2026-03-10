import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { RefreshCw, Printer, TrendingUp } from 'lucide-react';

const API_URL = "https://script.google.com/macros/s/AKfycbzPTqe8B0W68aKeH-2vKZEr6jcd0TAIeRpi4xX07E9ILNwnFEFpG22XnSBgihfpQB-UDQ/exec";

type KPI = 'PROD' | 'AHT' | 'RES' | 'PSAT' | 'TOTAL_CAL';
type Shift = 'mañana' | 'tarde' | 'noche';

interface ApiData {
  status: string;
  days: number[];
  data: {
    [key in Shift]: {
      [key in KPI]: number[];
    };
  };
}

export default function HourlyTrendsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<KPI>('PROD');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Network response was not ok');
      const json = await res.json() as ApiData;
      setData(json);
    } catch (err) {
      setError('Error al cargar datos. Verifique la conexión.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Format data for Recharts
  // { day: 'Día 1', mañana: 17, tarde: 184, noche: 345 }
  const chartData = data?.days.map((dayNum, index) => {
    return {
      name: `Semana ${dayNum}`,
      mañana: data.data.mañana[activeKpi][index] || 0,
      tarde: data.data.tarde[activeKpi][index] || 0,
      noche: data.data.noche[activeKpi][index] || 0,
    };
  }) || [];

  // Table Data (Averages/Sums)
  const getSummary = (shift: Shift) => {
    if (!data) return 0;
    const arr = data.data[shift][activeKpi];
    if (!arr || arr.length === 0) return 0;
    
    // For PROD and TOTAL_CAL we sum, for others we average
    if (activeKpi === 'PROD' || activeKpi === 'TOTAL_CAL') {
      return arr.reduce((a, b) => a + b, 0);
    } else {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return activeKpi === 'RES' || activeKpi === 'PSAT' ? avg * 100 : avg;
    }
  };

  const formatValue = (val: number, kpi: KPI) => {
    if (kpi === 'PROD' || kpi === 'TOTAL_CAL') return Math.round(val).toString();
    if (kpi === 'AHT') return val.toFixed(1) + 's';
    if (kpi === 'RES' || kpi === 'PSAT') {
      // Rates might be decimal 0-1 or already % 0-100.
      // Based on sample: 0.8 -> 80%
      const n = val <= 1 ? val * 100 : val;
      return n.toFixed(1) + '%';
    }
    return val.toString();
  };

  const kpis: { id: KPI; label: string }[] = [
    { id: 'PROD', label: 'Llamadas Prod.' },
    { id: 'AHT', label: 'TMO (AHT)' },
    { id: 'RES', label: 'Resolución' },
    { id: 'PSAT', label: 'PSAT' },
    { id: 'TOTAL_CAL', label: 'Encuestas' },
  ];

  const now = new Date();
  const timestamp = now.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
    + ' ' + now.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-[#1A1C1E] text-m3-secondary dark:text-m3-on-surface-dark font-sans animate-in fade-in duration-500">
      
      {/* ── Top bar ── */}
      <div className="bg-[#0a2540] text-white px-6 py-5 no-print">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-1">PedidosYa · Dashboard Evolutivo</p>
            <h1 className="text-2xl font-bold leading-tight">Tendencias por Tramos Horarios</h1>
            <p className="text-sm text-blue-200 mt-0.5">Equipo Edwin · Actualizado: {timestamp}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 mt-1">
            <button
              onClick={loadData}
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
      <div className="hidden print:block px-6 py-4 border-b border-gray-200">
        <p className="text-[10px] uppercase tracking-widest text-gray-400">PedidosYa · Dashboard Evolutivo</p>
        <h1 className="text-xl font-bold">Tendencias por Tramos Horarios — Equipo Edwin</h1>
        <p className="text-xs text-gray-500">Generado: {timestamp} | KPI Base: {activeKpi}</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 print:px-0">
        
        {/* KPI Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-8 no-print">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mr-2 flex items-center gap-2">
            <TrendingUp size={16} /> Analizar:
          </span>
          {kpis.map(k => (
            <button
              key={k.id}
              onClick={() => setActiveKpi(k.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors shadow-sm ${
                activeKpi === k.id
                  ? 'bg-m3-primary text-white border-m3-primary'
                  : 'bg-white dark:bg-[#2C2C2C] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Cargando métricas de horarios...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-center">
            {error}. Intenta recargar la página.
          </div>
        ) : !data ? null : (
          <div className="space-y-8">
            
            {/* Chart Card */}
            <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-m3-surface-variant/50 dark:border-white/10 shadow-sm">
              <h3 className="text-lg font-bold mb-6 text-center text-gray-800 dark:text-gray-200">
                Evolución Semanal: <span className="text-m3-primary">{kpis.find(k => k.id === activeKpi)?.label}</span>
              </h3>
              
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: '#6b7280' }} 
                      axisLine={false} 
                      tickLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#6b7280' }} 
                      axisLine={false} 
                      tickLine={false}
                      dx={-10}
                      tickFormatter={(val) => {
                        if (activeKpi === 'AHT') return `${val}s`;
                        if (activeKpi === 'RES' || activeKpi === 'PSAT') return `${val <= 1 && val > 0 ? val*100 : val}%`;
                        return val;
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: any) => [formatValue(activeKpi === 'RES' || activeKpi === 'PSAT' ? (val>1?val:val*100) : val, activeKpi), '']}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="mañana" 
                      name="Turno Mañana" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2 }} 
                      activeDot={{ r: 6 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tarde" 
                      name="Turno Tarde" 
                      stroke="#f97316" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#f97316', strokeWidth: 2 }} 
                      activeDot={{ r: 6 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="noche" 
                      name="Turno Noche" 
                      stroke="#a855f7" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#a855f7', strokeWidth: 2 }} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Table */}
            <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-m3-surface-variant/50 dark:border-white/10 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 pb-2 border-b border-gray-100 dark:border-white/10">
                Resumen Acumulado/Promedio ({kpis.find(k => k.id === activeKpi)?.label})
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                  <div>
                    <span className="text-blue-800 dark:text-blue-400 font-bold text-sm block mb-1">Turno Mañana</span>
                    <span className="text-xs text-blue-600 dark:text-blue-500">{(activeKpi==='PROD'||activeKpi==='TOTAL_CAL') ? 'Acumulado Semanal' : 'Promedio Semanal'}</span>
                  </div>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {formatValue(getSummary('mañana'), activeKpi)}
                  </span>
                </div>
                
                <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 flex items-center justify-between">
                  <div>
                    <span className="text-orange-800 dark:text-orange-400 font-bold text-sm block mb-1">Turno Tarde</span>
                    <span className="text-xs text-orange-600 dark:text-orange-500">{(activeKpi==='PROD'||activeKpi==='TOTAL_CAL') ? 'Acumulado Semanal' : 'Promedio Semanal'}</span>
                  </div>
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                    {formatValue(getSummary('tarde'), activeKpi)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <span className="text-purple-800 dark:text-purple-400 font-bold text-sm block mb-1">Turno Noche</span>
                    <span className="text-xs text-purple-600 dark:text-purple-500">{(activeKpi==='PROD'||activeKpi==='TOTAL_CAL') ? 'Acumulado Semanal' : 'Promedio Semanal'}</span>
                  </div>
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                    {formatValue(getSummary('noche'), activeKpi)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rounded-3xl { border-radius: 8px !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>
    </div>
  );
}
