import { useState, useEffect } from 'react';
import { getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { getPublicCollection, getPublicDoc } from '../firebasePaths';
import { 
  Building2, Plus, Trash2, Save, Loader2, Shield, 
  BarChart3, BookOpen, CheckCircle, Zap, Clock, Globe, Lightbulb, MessageSquare, Search
} from 'lucide-react';

interface LobConfig {
  id: string;
  name: string;
  currentMetricsUrl: string;    // URL for "Tu Impacto este Mes"
  historicalMetricsUrl: string; // URL for "Rendimiento 1-31"
  supervisorSuggestion?: string; // Phase 4: Segmented suggestions
  chatsSpreadsheetId?: string;   // Phase 5: GViz connection
  chatsSheetName?: string;
  apiUrl?: string;              // Legacy/General
  permissions: {
    canViewTraining: boolean;
    canViewQuizzes: boolean;
    canViewACW: boolean;
    canViewMetrics: boolean;
    canViewIdle: boolean;
    canViewChats: boolean;      // Phase 5
  };
}

const DEFAULT_PERMISSIONS = {
  canViewTraining: true,
  canViewQuizzes: true,
  canViewACW: true,
  canViewMetrics: true,
  canViewIdle: true,
  canViewChats: false
};

export default function AdminLobManager() {
  const [lobs, setLobs] = useState<LobConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New LOB Form
  const [newLob, setNewLob] = useState({ 
    id: '', 
    name: '', 
    currentMetricsUrl: '', 
    historicalMetricsUrl: '',
    supervisorSuggestion: '',
    chatsSpreadsheetId: '',
    chatsSheetName: ''
  });

  useEffect(() => {
    fetchLobs();
  }, []);

  const fetchLobs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(getPublicCollection('lobs'));
      const list = snap.docs.map(d => {
        const data = d.data();
        // Migración/Compatibilidad: Mapear nombres viejos a nuevos si existen
        const perms = data.permissions || {};
        return {
          id: d.id,
          name: data.name || '',
          currentMetricsUrl: data.currentMetricsUrl || data.apiUrl || '',
          historicalMetricsUrl: data.historicalMetricsUrl || '',
          supervisorSuggestion: data.supervisorSuggestion || '',
          chatsSpreadsheetId:   data.chatsSpreadsheetId || '',
          chatsSheetName:       data.chatsSheetName || '',
          apiUrl: data.apiUrl || '',
          permissions: {
            canViewTraining: perms.canViewTraining ?? perms.capacitaciones ?? true,
            canViewQuizzes:  perms.canViewQuizzes  ?? perms.quizzes ?? true,
            canViewACW:      perms.canViewACW      ?? perms.acw ?? true,
            canViewMetrics:  perms.canViewMetrics  ?? perms.metrics ?? true,
            canViewIdle:     perms.canViewIdle     ?? perms.idle_tracker ?? true,
            canViewChats:    perms.canViewChats    ?? false,
          }
        } as LobConfig;
      });
      setLobs(list);
    } catch (err) {
      console.error("Error fetching LOBs:", err);
      setError("No se pudieron cargar los LOBs.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newLob.id || !newLob.name) {
      alert("ID y Nombre son obligatorios.");
      return;
    }

    const lobId = newLob.id.toLowerCase().trim().replace(/\s+/g, '_');
    const config: LobConfig = {
      id: lobId,
      name: newLob.name.trim(),
      currentMetricsUrl: newLob.currentMetricsUrl.trim(),
      historicalMetricsUrl: newLob.historicalMetricsUrl.trim(),
      supervisorSuggestion: newLob.supervisorSuggestion.trim(),
      chatsSpreadsheetId: newLob.chatsSpreadsheetId.trim(),
      chatsSheetName: newLob.chatsSheetName.trim(),
      permissions: { ...DEFAULT_PERMISSIONS }
    };

    setSaving('new');
    try {
      await setDoc(getPublicDoc('lobs', lobId), config);
      setLobs(prev => [...prev, config]);
      setNewLob({ 
        id: '', name: '', currentMetricsUrl: '', historicalMetricsUrl: '', 
        supervisorSuggestion: '', chatsSpreadsheetId: '', chatsSheetName: '' 
      });
    } catch (err) {
      console.error("Error creating LOB:", err);
      alert("Error al crear el LOB.");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdate = async (lob: LobConfig) => {
    setSaving(lob.id);
    try {
      await setDoc(getPublicDoc('lobs', lob.id), lob);
    } catch (err) {
      console.error("Error updating LOB:", err);
      alert("Error al actualizar.");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este LOB? Esto afectará la visibilidad de los agentes.")) return;
    
    try {
      await deleteDoc(getPublicDoc('lobs', id));
      setLobs(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error("Error deleting LOB:", err);
    }
  };

  const togglePermission = (lobId: string, section: keyof LobConfig['permissions']) => {
    setLobs(prev => prev.map(lob => {
      if (lob.id === lobId) {
        const updated = {
          ...lob,
          permissions: { ...lob.permissions, [section]: !lob.permissions[section] }
        };
        handleUpdate(updated); // Background save
        return updated;
      }
      return lob;
    }));
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="animate-spin text-m3-primary" size={32} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-m3-primary/10 rounded-2xl">
          <Building2 className="text-m3-primary" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Gestión Multi-LOB (Permisos)</h3>
          <p className="text-sm text-gray-500">Crea áreas y controla qué módulos podrán ver los agentes.</p>
        </div>
      </div>

      {/* New LOB Form */}
      <div className="bg-m3-surface-variant/20 dark:bg-white/5 p-6 rounded-[28px] border border-m3-surface-variant/30">
        <h4 className="text-sm font-bold uppercase tracking-widest text-m3-secondary dark:text-gray-400 mb-4 flex items-center gap-2">
          <Plus size={16} /> Nuevo Área (LOB)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase text-gray-400 ml-1">ID del Segmento</label>
             <input 
                type="text" placeholder="ej: ventas_mexico"
                className="w-full px-4 py-3 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-sm font-bold outline-none focus:ring-2 focus:ring-m3-primary transition-all shadow-sm"
                value={newLob.id} onChange={e => setNewLob({...newLob, id: e.target.value})}
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nombre Desplegable</label>
             <input 
                type="text" placeholder="ej: Ventas"
                className="w-full px-4 py-3 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-sm font-bold outline-none focus:ring-2 focus:ring-m3-primary transition-all shadow-sm"
                value={newLob.name} onChange={e => setNewLob({...newLob, name: e.target.value})}
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase text-gray-400 ml-1">URL Métricas (Current)</label>
             <input 
                type="text" placeholder="https://script.google.com/..."
                className="w-full px-4 py-3 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-[10px] outline-none focus:ring-2 focus:ring-m3-primary transition-all shadow-sm"
                value={newLob.currentMetricsUrl} onChange={e => setNewLob({...newLob, currentMetricsUrl: e.target.value})}
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase text-gray-400 ml-1">URL Históricos (History)</label>
             <div className="flex gap-2">
                <input 
                    type="text" placeholder="https://script.google.com/..."
                    className="flex-1 px-4 py-3 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-[10px] outline-none focus:ring-2 focus:ring-m3-primary transition-all shadow-sm"
                    value={newLob.historicalMetricsUrl} onChange={e => setNewLob({...newLob, historicalMetricsUrl: e.target.value})}
                />
                <button 
                    onClick={handleCreate}
                    disabled={saving === 'new' || !newLob.id || !newLob.name}
                    className="px-6 py-3 bg-m3-primary text-white rounded-xl font-black shadow-md hover:scale-105 active:scale-95 transition-all text-[10px] uppercase flex items-center gap-2 disabled:bg-gray-300"
                >
                    {saving === 'new' ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                    Crear
                </button>
             </div>
          </div>
        </div>

        {/* Phase 4: New Suggeestion input in creation form? No, maybe just name it. 
            Actually let's add it to the edit area for better flow. 
        */}
      </div>

      {/* LOB List & Matrix */}
      <div className="space-y-6">
        {lobs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white dark:bg-transparent rounded-3xl border-2 border-dashed border-m3-surface-variant/30">
            No se han configurado áreas todavía.
          </div>
        ) : lobs.map(lob => (
          <div key={lob.id} className="bg-white dark:bg-[#1E1E1E] rounded-[28px] border border-m3-surface-variant/30 shadow-sm overflow-hidden group">
            {/* Header info */}
            <div className="p-6 border-b border-m3-surface-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-m3-surface-variant/10">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-m3-primary text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {lob.name.substring(0,2).toUpperCase()}
                  </div>
                  {saving === lob.id && (
                    <div className="absolute -top-1 -right-1 p-1 bg-white dark:bg-[#1E1E1E] rounded-full shadow-md">
                      <Loader2 className="animate-spin text-m3-primary" size={12} />
                    </div>
                  )}
                </div>
                <div>
                  <h5 className="font-bold text-m3-secondary dark:text-white flex items-center gap-2">
                    {lob.name} <span className="text-[10px] bg-m3-primary/10 text-m3-primary px-2 py-0.5 rounded-full uppercase font-black">{lob.id}</span>
                  </h5>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Globe size={12} />
                    <span className="truncate max-w-[250px]">{lob.currentMetricsUrl ? 'Métricas Actuales Configuradas' : 'Sin API de métricas'}</span>
                    {lob.historicalMetricsUrl && (
                        <>
                            <span className="mx-1">·</span>
                            <span className="text-[10px] text-m3-primary font-bold">Histórico OK</span>
                        </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleDelete(lob.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                  title="Eliminar LOB"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-m3-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Módulos Visibles (Interruptores)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <PermissionToggle 
                  icon={BookOpen} label="Capacitaciones" 
                  enabled={lob.permissions.canViewTraining} 
                  onChange={() => togglePermission(lob.id, 'canViewTraining')} 
                />
                <PermissionToggle 
                  icon={CheckCircle} label="Quizzes" 
                  enabled={lob.permissions.canViewQuizzes} 
                  onChange={() => togglePermission(lob.id, 'canViewQuizzes')} 
                />
                <PermissionToggle 
                  icon={Zap} label="Simulador ACW" 
                  enabled={lob.permissions.canViewACW} 
                  onChange={() => togglePermission(lob.id, 'canViewACW')} 
                />
                <PermissionToggle 
                  icon={BarChart3} label="Métricas Dash" 
                  enabled={lob.permissions.canViewMetrics} 
                  onChange={() => togglePermission(lob.id, 'canViewMetrics')} 
                />
                <PermissionToggle 
                  icon={Clock} label="Idle Tracker" 
                  enabled={lob.permissions.canViewIdle} 
                  onChange={() => togglePermission(lob.id, 'canViewIdle')} 
                />
                <PermissionToggle 
                  icon={MessageSquare} label="Auditoría Chats" 
                  enabled={lob.permissions.canViewChats} 
                  onChange={() => togglePermission(lob.id, 'canViewChats')} 
                />
              </div>
            </div>

            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Métricas Actuales (Cards)</label>
                <input 
                  type="text" placeholder="URL para tarjetas..."
                  className="w-full px-4 py-2.5 rounded-xl border border-m3-surface-variant/30 bg-m3-surface/50 dark:bg-[#121212] text-[10px] font-bold outline-none focus:ring-1 focus:ring-m3-primary transition-all"
                  value={lob.currentMetricsUrl} 
                  onChange={e => {
                    const val = e.target.value;
                    setLobs(prev => prev.map(l => l.id === lob.id ? {...l, currentMetricsUrl: val} : l));
                  }}
                  onBlur={() => handleUpdate(lob)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Métricas Históricas (Gráficas)</label>
                <input 
                  type="text" placeholder="URL para historial..."
                  className="w-full px-4 py-2.5 rounded-xl border border-m3-surface-variant/30 bg-m3-surface/50 dark:bg-[#121212] text-[10px] font-bold outline-none focus:ring-1 focus:ring-m3-primary transition-all"
                  value={lob.historicalMetricsUrl} 
                  onChange={e => {
                    const val = e.target.value;
                    setLobs(prev => prev.map(l => l.id === lob.id ? {...l, historicalMetricsUrl: val} : l));
                  }}
                  onBlur={() => handleUpdate(lob)}
                />
              </div>
              
              {/* Phase 5: Chats Database Config */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Spreadsheet ID (Auditoría Chats)</label>
                <input 
                  type="text" placeholder="Spreadsheet ID alfanumérico..."
                  className="w-full px-4 py-2.5 rounded-xl border border-m3-surface-variant/30 bg-m3-surface/50 dark:bg-[#121212] text-[10px] font-bold outline-none focus:ring-1 focus:ring-m3-primary transition-all"
                  value={lob.chatsSpreadsheetId} 
                  onChange={e => {
                    const val = e.target.value;
                    setLobs(prev => prev.map(l => l.id === lob.id ? {...l, chatsSpreadsheetId: val} : l));
                  }}
                  onBlur={() => handleUpdate(lob)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nombre de Hoja (Sheet Name)</label>
                <input 
                  type="text" placeholder="BaseDatos, Hoja 1, etc."
                  className="w-full px-4 py-2.5 rounded-xl border border-m3-surface-variant/30 bg-m3-surface/50 dark:bg-[#121212] text-[10px] font-bold outline-none focus:ring-1 focus:ring-m3-primary transition-all"
                  value={lob.chatsSheetName} 
                  onChange={e => {
                    const val = e.target.value;
                    setLobs(prev => prev.map(l => l.id === lob.id ? {...l, chatsSheetName: val} : l));
                  }}
                  onBlur={() => handleUpdate(lob)}
                />
              </div>
            </div>

            {/* Phase 4: Segmented Suggestions */}
            <div className="px-6 pb-6">
               <div className="flex flex-col gap-1.5 p-5 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-[24px] border border-yellow-100 dark:border-yellow-900/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} className="text-yellow-600" />
                    <label className="text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-400 tracking-widest">Sugerencia para este Equipo (LOB)</label>
                  </div>
                  <textarea 
                    placeholder="Escribe el foco de la semana o consejos para este área..."
                    className="w-full px-4 py-3 rounded-xl border border-m3-surface-variant/20 bg-white dark:bg-[#121212] text-xs outline-none focus:ring-1 focus:ring-m3-primary transition-all resize-none min-h-[80px]"
                    value={lob.supervisorSuggestion} 
                    onChange={e => {
                      const val = e.target.value;
                      setLobs(prev => prev.map(l => l.id === lob.id ? {...l, supervisorSuggestion: val} : l));
                    }}
                    onBlur={() => handleUpdate(lob)}
                  />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionToggle({ icon: Icon, label, enabled, onChange }: any) {
  return (
    <button 
      onClick={onChange}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all group/btn
        ${enabled 
          ? 'bg-m3-primary/5 border-m3-primary/40 text-m3-primary shadow-sm scale-100' 
          : 'bg-transparent border-m3-surface-variant/20 text-gray-400 opacity-60 grayscale scale-95'}
      `}
    >
      <Icon size={20} className={enabled ? 'animate-in zoom-in duration-300' : ''} />
      <span className="text-[9px] font-bold uppercase tracking-tight text-center">{label}</span>
      <div className={`
        w-8 h-4 rounded-full relative transition-colors
        ${enabled ? 'bg-m3-primary' : 'bg-gray-300 dark:bg-gray-600'}
      `}>
        <div className={`
          absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all
          ${enabled ? 'left-4.5' : 'left-0.5'}
        `} />
      </div>
    </button>
  );
}
