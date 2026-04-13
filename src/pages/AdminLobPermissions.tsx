import { useState, useEffect } from 'react';
import { getDoc, setDoc } from 'firebase/firestore';
import { getPublicDoc } from '../firebasePaths';
import { Shield, BookOpen, CheckCircle, Zap, Clock, BarChart3, Loader2, Save, AlertCircle } from 'lucide-react';

const LOBS = [
  { id: 'phone', label: 'Phone / General' },
  { id: 'recupero', label: 'Recupero' },
  { id: 'b2x', label: 'B2X' }
];

const SECTIONS = [
  { id: 'capacitaciones', label: 'Capacitaciones', icon: BookOpen },
  { id: 'quizzes', label: 'Retos / Quizzes', icon: CheckCircle },
  { id: 'acw', label: 'Simulador ACW', icon: Zap },
  { id: 'idle_tracker', label: 'Idle Tracker', icon: Clock },
  { id: 'metrics', label: 'Métricas (Dashboard)', icon: BarChart3 },
];

interface PermissionConfig {
  [lobId: string]: {
    [sectionId: string]: boolean;
  };
}

export default function AdminLobPermissions() {
  const [config, setConfig] = useState<PermissionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const docRef = getPublicDoc('module_config', 'visibility_matrix');
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        setConfig(snap.data() as PermissionConfig);
      } else {
        // Default: everything enabled
        const defaultConfig: PermissionConfig = {};
        LOBS.forEach(lob => {
          defaultConfig[lob.id] = {};
          SECTIONS.forEach(sec => {
            defaultConfig[lob.id][sec.id] = true;
          });
        });
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (lobId: string, sectionId: string) => {
    if (!config) return;

    const newValue = !config[lobId]?.[sectionId];
    const newConfig = {
      ...config,
      [lobId]: {
        ...(config[lobId] || {}),
        [sectionId]: newValue
      }
    };

    // Optimistic update
    setConfig(newConfig);
    setSaving(`${lobId}-${sectionId}`);

    try {
      const docRef = getPublicDoc('module_config', 'visibility_matrix');
      await setDoc(docRef, newConfig, { merge: true });
    } catch (error) {
      console.error("Error saving permission:", error);
      // Rollback on error
      fetchConfig();
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-m3-primary" size={32} />
        <p className="text-sm text-gray-500">Cargando matriz de permisos...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8 flex items-center gap-4">
        <div className="p-3 bg-m3-primary/10 rounded-2xl">
          <Shield className="text-m3-primary" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Gestión de Visibilidad</h3>
          <p className="text-sm text-gray-500">Controla qué módulos ve cada área en su pantalla principal.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="overflow-x-auto rounded-3xl border border-m3-surface-variant/30 bg-white dark:bg-[#1E1E1E] shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-m3-surface-variant/40 dark:bg-white/5 backdrop-blur-md border-b border-m3-surface-variant/30">
                <th className="px-6 py-4 text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider">Área (LOB)</th>
                {SECTIONS.map(sec => (
                  <th key={sec.id} className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <sec.icon size={18} className="text-m3-primary" />
                      <span className="text-[10px] font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-widest whitespace-nowrap">
                        {sec.label}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
              {LOBS.map(lob => (
                <tr key={lob.id} className="hover:bg-m3-surface-variant/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark">
                      {lob.label}
                    </span>
                  </td>
                  {SECTIONS.map(sec => {
                    const isEnabled = config?.[lob.id]?.[sec.id] ?? true;
                    const isWorking = saving === `${lob.id}-${sec.id}`;
                    
                    return (
                      <td key={sec.id} className="px-6 py-5 text-center">
                        <label className="relative inline-flex items-center cursor-pointer group">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={isEnabled}
                            disabled={isWorking}
                            onChange={() => togglePermission(lob.id, sec.id)}
                          />
                          <div className={`
                            w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none 
                            rounded-full peer peer-checked:after:translate-x-full 
                            peer-checked:after:border-white after:content-[''] after:absolute 
                            after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 
                            after:border after:rounded-full after:h-5 after:w-5 after:transition-all 
                            peer-checked:bg-m3-primary
                            ${isWorking ? 'opacity-50 grayscale' : ''}
                          `}></div>
                          {isWorking && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="animate-spin text-white" size={12} />
                            </div>
                          )}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-start gap-4 border border-blue-100 dark:border-blue-800/30">
          <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            <strong>Nota:</strong> Los cambios se aplican en tiempo real. Si desactivas una sección, los agentes de esa área dejarán de verla en su menú y no podrán acceder aunque tengan el link directo.
          </p>
        </div>
      </div>
    </div>
  );
}
