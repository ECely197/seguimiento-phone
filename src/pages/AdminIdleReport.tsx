import { useState, useEffect } from 'react';
import { getDocsWithFallback } from '../firebasePaths';
import { Loader2, Search, Calendar, Clock, Filter, Download, User as UserIcon } from 'lucide-react';

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

export default function AdminIdleReport() {
  const [records, setRecords] = useState<IdleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLOB, setFilterLOB] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log("[AdminIdleReport] Cargando reportes de disponibilidad (Doble Fetch)...");
      const snap = await getDocsWithFallback('idle_tracker');
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as IdleRecord));
      // Sort by date/time descending
      data.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setRecords(data);
    } catch (err) {
      console.error("Error fetching idle records:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper for totals
  const calculateTotalMinutes = (filteredRecords: IdleRecord[]) => {
    return filteredRecords.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
  };

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  
  // Weekly total (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  // Monthly total (this calendar month)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const dailyRecords = records.filter(r => r.date === todayStr);
  const weeklyRecords = records.filter(r => new Date(r.date) >= oneWeekAgo);
  const monthlyRecords = records.filter(r => new Date(r.date) >= monthStart);

  const filtered = records.filter(r => {
    const matchesSearch = r.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.comment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLOB = filterLOB === 'all' || r.lob?.toLowerCase() === filterLOB.toLowerCase();
    return matchesSearch && matchesLOB;
  });

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-m3-primary" size={40} />
        <p className="text-sm text-gray-500">Generando reporte de disponibilidad...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 p-6 rounded-[28px] space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Hoy</p>
            <Clock size={16} className="text-orange-500" />
          </div>
          <p className="text-3xl font-black dark:text-white">{formatHours(calculateTotalMinutes(dailyRecords))}</p>
          <p className="text-xs text-orange-600/70">{dailyRecords.length} registros hoy</p>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 p-6 rounded-[28px] space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Últimos 7 días</p>
            <Calendar size={16} className="text-blue-500" />
          </div>
          <p className="text-3xl font-black dark:text-white">{formatHours(calculateTotalMinutes(weeklyRecords))}</p>
          <p className="text-xs text-blue-600/70">{weeklyRecords.length} registros esta semana</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 p-6 rounded-[28px] space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Este Mes</p>
            <Filter size={16} className="text-purple-500" />
          </div>
          <p className="text-3xl font-black dark:text-white">{formatHours(calculateTotalMinutes(monthlyRecords))}</p>
          <p className="text-xs text-purple-600/70">{monthlyRecords.length} registros en el mes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-m3-surface-variant/20 dark:bg-white/5 p-4 rounded-[24px] border border-m3-surface-variant/30">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por agente, correo o comentario..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 text-sm outline-none focus:ring-2 focus:ring-m3-primary dark:text-white"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={filterLOB} 
            onChange={e => setFilterLOB(e.target.value)}
            className="px-4 py-2.5 rounded-full bg-white dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 text-sm outline-none dark:text-white"
          >
            <option value="all">Todos los LOB</option>
            <option value="recupero">Recupero</option>
            <option value="phone">Phone</option>
            <option value="b2x">B2X</option>
          </select>
          
          <button 
            onClick={() => {/* Implement CSV Export if needed */}}
            className="p-2.5 bg-m3-primary text-white rounded-full hover:bg-m3-primary/90 transition-colors"
            title="Exportar Reporte"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[24px] border border-m3-surface-variant/30 bg-white dark:bg-black/10 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Agente</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">LOB</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Fecha</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Rango</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Duración</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Comentario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400 italic">No se encontraron registros de disponibilidad.</td>
              </tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-m3-primary/10 flex items-center justify-center text-m3-primary">
                      <UserIcon size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-sm dark:text-white leading-none">{r.userName}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{r.userEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    r.lob === 'recupero' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {r.lob}
                  </span>
                </td>
                <td className="p-4 text-sm dark:text-gray-300">{r.date}</td>
                <td className="p-4 text-center">
                  <div className="text-[10px] font-mono text-gray-500">
                    {new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    <span className="mx-1">→</span>
                    {new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="font-mono font-bold text-m3-primary dark:text-m3-primary-dark">
                    {r.durationMinutes} min
                  </span>
                </td>
                <td className="p-4">
                  <p className="text-xs text-gray-500 italic max-w-xs">{r.comment}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
