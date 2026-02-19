import { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import { getAgentData } from '../api/sheetService';
import { ADMIN_UID } from '../constants';
import { TrendingUp, CheckCircle, ClipboardList, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

interface AgentData {
  "Correo": string;
  "PSAT": string;
  "RES": string;
  "Agente": string; // Updated key
  "AHT Real": string; // New metric with space
  "ATT": string;
  "ACW": string;
  "auditorias_completadas"?: string; // Kept as optional fallback
  "sugerencia"?: string;
  [key: string]: any;
}

// Helper functions
const formatPercentage = (value: string | undefined) => {
    if (!value) return "-";
    const num = parseFloat(value.replace(/[^0-9.]/g, '')); 
    if (isNaN(num)) return value;
    return `${num}%`;
};

const getPsatColor = (value: string | undefined) => {
     if (!value) return "text-blue-600 dark:text-blue-400";
     const num = parseFloat(value.replace(/[^0-9.]/g, ''));
     if (isNaN(num)) return "text-blue-600 dark:text-blue-400";
     if (num < 80) return "text-[var(--color-m3-error)] dark:text-[var(--color-m3-error-dark)]";
     return "text-emerald-600 dark:text-emerald-400";
};

export default function HomePage() {
  const [agentIsLoading, setAgentIsLoading] = useState(true);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Keep loading state to prevent flash of unauthorized content
        navigate('/', { replace: true });
        return;
      }

      if (user) {
        // Admin Bypass
        if (user.uid === ADMIN_UID) {
            setIsAdmin(true);
            setAgentIsLoading(false);
            return; 
        }

        if (user.email) {
            try {
              const agents = await getAgentData(user.email);
              console.log("SheetDB Data:", agents);
              
              if (agents && agents.length > 0) {
                setAgentData(agents[0]);
                setError(null);
              } else {
                 console.warn(`Usuario no encontrado: ${user.email}`);
                 setError("Usuario no encontrado");
                 setAgentData(null);
              }
            } catch (error) {
              console.error("Error al cargar de SheetDB:", error);
              setError("No se pudieron cargar los datos de la base de datos.");
              setAgentData(null);
            } finally {
              setAgentIsLoading(false);
            }
        }
      } else {
        setAgentIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (agentIsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-m3-surface dark:bg-m3-surface-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-m3-primary dark:border-m3-primary-dark"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-m3-surface-dark p-4 pb-24 transition-colors duration-300">
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold text-m3-primary dark:text-m3-primary-dark">
           Hello, {agentData?.Agente || "Agente"}
        </h1>
        <p className="text-m3-secondary dark:text-m3-on-surface-dark/70 text-sm">
            {isAdmin ? "Vista de administración." : "Aquí están tus métricas de hoy."}
        </p>
        
        {auth.currentUser?.uid === ADMIN_UID && (
            <button 
                onClick={() => navigate('/admin')}
                className="mt-4 px-6 py-2 bg-m3-primary dark:bg-m3-primary-dark text-white dark:text-m3-surface-dark font-bold rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
                Ir al Panel de Supervisor
            </button>
        )}
      </header>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <>
            {isAdmin ? (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                    <div className="bg-m3-primary/10 dark:bg-m3-primary-dark/20 p-6 rounded-full mb-6">
                        <ClipboardList className="text-m3-primary dark:text-m3-primary-dark" size={64} />
                    </div>
                    <h2 className="text-3xl font-bold text-m3-primary dark:text-m3-primary-dark mb-2 text-center">
                        Bienvenido Supervisor
                    </h2>
                    <p className="text-xl text-m3-secondary dark:text-m3-on-surface-dark/70 mb-8 font-medium animate-pulse">
                        Cargando Panel de Control...
                    </p>
                    <button 
                        onClick={() => navigate('/admin')}
                        className="px-8 py-4 bg-m3-primary dark:bg-m3-primary-dark text-white dark:text-m3-surface-dark font-bold text-lg rounded-[28px] shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-3"
                    >
                        Ir al Panel de Supervisor
                    </button>
                </div>
            ) : (
            <>
                {/* 6 Metric Cards Layout */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <MetricCard 
                        title="Agente" 
                        value={agentData?.['Agente'] || "-"} 
                        icon={ClipboardList} 
                        color="text-m3-primary dark:text-m3-primary-dark"
                        bgColor="bg-m3-primary/10"
                    />
                    <MetricCard 
                        title="AHT Real" 
                        value={agentData?.['AHT Real'] || "-"} 
                        icon={ClipboardList} 
                        color="text-purple-600 dark:text-purple-400"
                        bgColor="bg-purple-50"
                    />
                     <MetricCard 
                        title="ATT" 
                        value={agentData?.['ATT'] || "-"} 
                        icon={ClipboardList} 
                        color="text-orange-600 dark:text-orange-400"
                        bgColor="bg-orange-50"
                    />
                     <MetricCard 
                        title="ACW" 
                        value={agentData?.['ACW'] || "-"} 
                        icon={ClipboardList} 
                        color="text-teal-600 dark:text-teal-400"
                        bgColor="bg-teal-50"
                    />
                     <MetricCard 
                        title="RES" 
                        value={formatPercentage(agentData?.['RES'])} 
                        icon={CheckCircle} 
                        color="text-green-600 dark:text-green-400"
                        bgColor="bg-green-50"
                    />
                    <MetricCard 
                        title="PSAT" 
                        value={formatPercentage(agentData?.['PSAT'])} 
                        icon={TrendingUp} 
                        color={getPsatColor(agentData?.['PSAT'])}
                        bgColor="bg-blue-50"
                    />
                </section>

                 <section className="bg-m3-surface-variant/30 dark:bg-m3-surface-variant/10 rounded-[28px] p-8 shadow-sm dark:shadow-none border border-m3-surface-variant/50 dark:border-transparent transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-white dark:bg-m3-primary-dark/20 rounded-full shadow-sm">
                            <Lightbulb className="text-yellow-600 dark:text-yellow-300" size={24} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-xl font-semibold text-m3-secondary dark:text-m3-on-surface-dark">Sugerencia del Supervisor</h2>
                    </div>
                    <div className="bg-white dark:bg-[#1E1E1E]/50 rounded-2xl p-6 border border-white/50 dark:border-white/5 mx-[-8px] sm:mx-0">
                        <p className="text-m3-secondary dark:text-m3-on-surface-dark/90 text-lg leading-loose font-medium italic">
                            "{agentData?.sugerencia || "No hay sugerencias disponibles por el momento."}"
                        </p>
                    </div>
                </section>
            </>
            )}
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, bgColor }: { title: string, value: string, icon: any, color: string, bgColor: string }) {
    return (
        <div className="bg-white dark:bg-[#2A2C2E] rounded-[28px] p-8 shadow-sm dark:shadow-none flex flex-col items-start justify-between border border-m3-surface-variant/50 dark:border-m3-surface-variant/30 h-40 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className={`absolute top-0 right-0 p-4 rounded-bl-[28px] ${bgColor} dark:bg-m3-surface-variant/10`}>
                <Icon className={color} size={28} />
            </div>
            <h3 className="text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/70 uppercase tracking-wider">{title}</h3>
            <p className={`text-4xl font-bold ${color} dark:text-m3-on-surface-dark`}>{value}</p>
        </div>
    );
}
