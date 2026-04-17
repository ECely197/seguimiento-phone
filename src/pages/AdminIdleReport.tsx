import { useState, useEffect } from 'react';
import { getDocsWithFallback } from '../firebasePaths';
import { Loader2, Search, Calendar, Clock, Filter, Download, User as UserIcon, Building2 } from 'lucide-react';

interface IdleRecord {
  id: string;
  userName: string;
  userEmail: string;
  lob: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  durationMinutes: number;
  comment: string;
  createdAt?: any;
}

export default function AdminIdleReport({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
  const [records, setRecords] = useState<IdleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [globalLobFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const snap = await getDocsWithFallback('idle_tracker');
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as IdleRecord));
      data.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setRecords(data);
    } catch (err) {
      console.error("Error fetching idle records:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalMinutes = (filteredRecords: IdleRecord[]) => {
    return filteredRecords.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
  };

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Integrated Filtering ──
  const filtered = records.filter(r => {
    // 1. Search Filter
    const matchesSearch = r.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.comment.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Global LOB Filter (Priority)
    const matchesLOB = (!globalLobFilter || globalLobFilter === 'all') 
                       ? true 
                       : (r.lob?.toLowerCase() === globalLobFilter.toLowerCase());
    
    return matchesSearch && matchesLOB;
  });

  const dailyRecords = filtered.filter(r => r.date === todayStr);
  const weeklyRecords = filtered.filter(r => new Date(r.date) >= oneWeekAgo);
  const monthlyRecords = filtered.filter(r => new Date(r.date) >= monthStart);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-32 gap-4">
      <Loader2 className="animate-spin text-m3-primary" size={40} />
      <p className="text-[10px] font-black uppercase text-gray-400">Consolidando Reporte de Disponibilidad...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Stats Cards - Executive Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1E1E1E] border border-orange-200/50 dark:border-orange-500/20 p-6 rounded-[32px] shadow-sm relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Actividad Hoy</p>
            <Clock size={18} className="text-orange-500" />
          </div>
          <p className="text-4xl font-black text-m3-secondary dark:text-white mt-4">{formatHours(calculateTotalMinutes(dailyRecords))}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              {dailyRecords.length} transacciones registradas
          </p>
        </div>
        
        <div className="bg-white dark:bg-[#1E1E1E] border border-blue-200/50 dark:border-blue-500/20 p-6 rounded-[32px] shadow-sm relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Semanal (7D)</p>
            <Calendar size={18} className="text-blue-500" />
          </div>
          <p className="text-4xl font-black text-m3-secondary dark:text-white mt-4">{formatHours(calculateTotalMinutes(weeklyRecords))}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">{weeklyRecords.length} registros acumulados</p>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] border border-purple-200/50 dark:border-purple-500/20 p-6 rounded-[32px] shadow-sm relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500" />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Periodo Mensual</p>
            <Filter size={18} className="text-purple-500" />
          </div>
          <p className="text-4xl font-black text-m3-secondary dark:text-white mt-4">{formatHours(calculateTotalMinutes(monthlyRecords))}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">Cierre de mes proyectado</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-m3-surface-variant/10 dark:bg-white/[0.02] p-4 rounded-[28px] border border-m3-surface-variant/30">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Filtrar por agente, correo o comentario..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-[#2C2C2C] border border-m3-surface-variant/50 dark:border-white/10 text-sm font-bold focus:ring-2 focus:ring-m3-primary dark:text-white transition-all shadow-sm outline-none"
          />
        </div>
        
        {globalLobFilter !== 'all' && (
            <div className="flex items-center gap-2 px-5 py-3 bg-m3-primary/10 rounded-2xl border border-m3-primary/20">
                <Building2 size={16} className="text-m3-primary" />
                <span className="text-[10px] font-black text-m3-primary uppercase tracking-widest">Área: {globalLobFilter}</span>
            </div>
        )}
      </div>

      {/* Table - Redesigned */}
      <div className="overflow-x-auto rounded-[32px] border border-m3-surface-variant/30 bg-white dark:bg-[#1A1A1A] shadow-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-m3-surface-variant/20 dark:bg-white/5 border-b border-m3-surface-variant/20">
              <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Identidad del Agente</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Área</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Calendario</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase text-center">Intervalo Horario</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase text-center">Inversión</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase">Contexto / Comentario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-20 text-center text-gray-400 text-xs font-bold uppercase tracking-widest opacity-20">
                    Sin registros en el segmento operativo actual
                </td>
              </tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover:bg-m3-primary/5 dark:hover:bg-white/5 transition-all group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl bg-m3-surface-variant/30 group-hover:bg-m3-primary group-hover:text-white flex items-center justify-center text-m3-primary transition-all shadow-sm">
                      <UserIcon size={16} />
                    </div>
                    <div>
                      <p className="font-black text-xs text-m3-secondary dark:text-white leading-none">{r.userName}</p>
                      <p className="text-[10px] text-gray-500 mt-1 font-bold">{r.userEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm ${
                    r.lob === 'recupero' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {r.lob}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-[10px] font-black text-m3-secondary dark:text-gray-400">{r.date}</td>
                <td className="px-6 py-4 text-center">
                  <div className="text-[10px] font-black bg-m3-surface-variant/10 dark:bg-black/20 py-1 rounded-lg text-gray-500">
                    {new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    <span className="mx-2 text-m3-primary opacity-40">→</span>
                    {new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-xs font-black text-m3-primary dark:text-m3-primary-dark">
                    {r.durationMinutes}m
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[10px] text-gray-500 font-bold italic leading-relaxed max-w-xs">{r.comment}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
