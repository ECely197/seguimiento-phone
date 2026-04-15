import { useState, useEffect } from 'react';
import { getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { getPublicCollection, getPublicDoc } from '../firebasePaths';
import { 
  Building2, Plus, Trash2, Save, Loader2, Shield, 
  BarChart3, BookOpen, CheckCircle, Zap, Clock, Globe 
} from 'lucide-react';

interface LobConfig {
  id: string;
  name: string;
  apiUrl: string;
  permissions: {
    capacitaciones: boolean;
    quizzes: boolean;
    acw: boolean;
    idle_tracker: boolean;
    metrics: boolean;
  };
}

const DEFAULT_PERMISSIONS = {
  capacitaciones: true,
  quizzes: true,
  acw: true,
  idle_tracker: true,
  metrics: true
};

export default function AdminLobManager() {
  const [lobs, setLobs] = useState<LobConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New LOB Form
  const [newLob, setNewLob] = useState({ id: '', name: '', apiUrl: '' });

  useEffect(() => {
    fetchLobs();
  }, []);

  const fetchLobs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(getPublicCollection('lobs'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LobConfig));
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
      apiUrl: newLob.apiUrl.trim(),
      permissions: { ...DEFAULT_PERMISSIONS }
    };

    setSaving('new');
    try {
      await setDoc(getPublicDoc('lobs', lobId), config);
      setLobs(prev => [...prev, config]);
      setNewLob({ id: '', name: '', apiUrl: '' });
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
          <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Gestión Multi-LOB</h3>
          <p className="text-sm text-gray-500">Crea áreas y define sus permisos y fuentes de datos.</p>
        </div>
      </div>

      {/* New LOB Form */}
      <div className="bg-m3-surface-variant/20 dark:bg-white/5 p-6 rounded-[28px] border border-m3-surface-variant/30">
        <h4 className="text-sm font-bold uppercase tracking-widest text-m3-secondary dark:text-gray-400 mb-4 flex items-center gap-2">
          <Plus size={16} /> Nuevo Área (LOB)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input 
            type="text" placeholder="ID único (ej: ventas_mexico)"
            className="px-4 py-2.5 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-sm outline-none focus:ring-2 focus:ring-m3-primary"
            value={newLob.id} onChange={e => setNewLob({...newLob, id: e.target.value})}
          />
          <input 
            type="text" placeholder="Nombre Comercial (ej: Ventas)"
            className="px-4 py-2.5 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-sm outline-none focus:ring-2 focus:ring-m3-primary"
            value={newLob.name} onChange={e => setNewLob({...newLob, name: e.target.value})}
          />
          <div className="flex gap-2">
            <input 
              type="text" placeholder="URL API Métricas (Google Script)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-m3-surface-variant bg-white dark:bg-[#2C2C2C] text-sm outline-none focus:ring-2 focus:ring-m3-primary"
              value={newLob.apiUrl} onChange={e => setNewLob({...newLob, apiUrl: e.target.value})}
            />
            <button 
              onClick={handleCreate}
              disabled={saving === 'new'}
              className="px-6 py-2.5 bg-m3-primary text-white rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2"
            >
              {saving === 'new' ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Añadir
            </button>
          </div>
        </div>
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
                <div className="w-10 h-10 rounded-full bg-m3-primary text-white flex items-center justify-center font-bold">
                  {lob.name.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <h5 className="font-bold text-m3-secondary dark:text-white flex items-center gap-2">
                    {lob.name} <span className="text-[10px] bg-m3-primary/10 text-m3-primary px-2 py-0.5 rounded-full uppercase">{lob.id}</span>
                  </h5>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Globe size={12} />
                    <span className="truncate max-w-[300px]">{lob.apiUrl || 'Sin API configurada'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleDelete(lob.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-m3-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Módulos Activos</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <PermissionToggle 
                  icon={BookOpen} label="Capacitaciones" 
                  enabled={lob.permissions.capacitaciones} 
                  onChange={() => togglePermission(lob.id, 'capacitaciones')} 
                />
                <PermissionToggle 
                  icon={CheckCircle} label="Quizzes" 
                  enabled={lob.permissions.quizzes} 
                  onChange={() => togglePermission(lob.id, 'quizzes')} 
                />
                <PermissionToggle 
                  icon={Zap} label="Simulador ACW" 
                  enabled={lob.permissions.acw} 
                  onChange={() => togglePermission(lob.id, 'acw')} 
                />
                <PermissionToggle 
                  icon={Clock} label="Idle Tracker" 
                  enabled={lob.permissions.idle_tracker} 
                  onChange={() => togglePermission(lob.id, 'idle_tracker')} 
                />
                <PermissionToggle 
                  icon={BarChart3} label="Dashboard" 
                  enabled={lob.permissions.metrics} 
                  onChange={() => togglePermission(lob.id, 'metrics')} 
                />
              </div>
            </div>

            {/* API Edit Area */}
            <div className="px-6 pb-6 mt-2">
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="Cambiar URL de API..."
                  className="flex-1 px-4 py-2 rounded-xl border border-m3-surface-variant/30 bg-m3-surface/50 dark:bg-[#121212] text-xs outline-none focus:ring-1 focus:ring-m3-primary"
                  value={lob.apiUrl} 
                  onChange={e => {
                    const val = e.target.value;
                    setLobs(prev => prev.map(l => l.id === lob.id ? {...l, apiUrl: val} : l));
                  }}
                  onBlur={() => handleUpdate(lob)}
                />
                {saving === lob.id && <Loader2 className="animate-spin text-m3-primary mt-1.5" size={16} />}
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
          ? 'bg-m3-primary/5 border-m3-primary/40 text-m3-primary shadow-sm' 
          : 'bg-transparent border-m3-surface-variant/20 text-gray-400 opacity-60 grayscale'}
      `}
    >
      <Icon size={20} className={enabled ? 'animate-in zoom-in duration-300' : ''} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
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
