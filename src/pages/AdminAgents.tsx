import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ChevronRight, Search, X, Loader2, TrendingUp, CheckCircle, XCircle, RefreshCw, User, Edit3, Save } from 'lucide-react';
import { updateAgentSuggestion, getAllAgents } from '../api/sheetService';

interface Agent {
  id: string;
  agente?: string;
  name?: string;
  correo?: string;
  email?: string;
  sugerencia?: string;
  [key: string]: any;
}


export default function AdminAgents() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [suggestion, setSuggestion] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Quiz Results State
    const [agentResults, setAgentResults] = useState<any[]>([]);
    const [quizMap, setQuizMap] = useState<Record<string, string>>({});
    const [resultsLoading, setResultsLoading] = useState(false);

    useEffect(() => {
        loadAgents();
        fetchQuizzes();
    }, []);

    useEffect(() => {
        if (selectedAgent) {
            const email = selectedAgent.correo || selectedAgent.email;
            if (email) fetchAgentResults(email);
        }
    }, [selectedAgent]);

    const loadAgents = async () => {
        try {
            setLoading(true);
            const data = await getAllAgents();
            setAgents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error loading agents:", err);
            setError("No se pudieron cargar los agentes.");
        } finally {
            setLoading(false);
        }
    };

    const fetchQuizzes = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'quizzes'));
            const mapping: Record<string, string> = {};
            snapshot.forEach(doc => {
                mapping[doc.id] = doc.data().situation || doc.data().title || 'Quiz Desconocido';
            });
            setQuizMap(mapping);
        } catch (err) {
            console.error("Error fetching quiz map:", err);
        }
    };

    const fetchAgentResults = async (email: string) => {
        setResultsLoading(true);
        try {
            const q = query(collection(db, 'resultados_quizzes'), where('agentEmail', '==', email));
            const snapshot = await getDocs(q);
            const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAgentResults(results);
        } catch (err) {
            console.error("Error fetching agent results:", err);
        } finally {
            setResultsLoading(false);
        }
    };

    const deleteResult = async (resultId: string) => {
        if (!confirm("¿Reiniciar este intento? El agente podrá tomar el quiz de nuevo.")) return;
        try {
            await deleteDoc(doc(db, 'resultados_quizzes', resultId));
            setAgentResults(prev => prev.filter(r => r.id !== resultId));
        } catch (err) {
            console.error("Error deleting result:", err);
        }
    };

    const calculateAccuracy = () => {
        if (agentResults.length === 0) return 0;
        const correct = agentResults.filter(r => r.isCorrect).length;
        return Math.round((correct / agentResults.length) * 100);
    };

    const handleSelectAgent = (agent: any) => {
        setSelectedAgent(agent);
        setSuggestion(agent.sugerencia || '');
        setError(null);
    };

    const handleSaveSuggestion = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        try {
            await updateAgentSuggestion(selectedAgent.correo || "", suggestion);
            // Update local state
            setAgents(prev => prev.map(a => 
                a.correo === selectedAgent.correo ? { ...a, sugerencia: suggestion } : a
            ));
            // Keep modal open or close? User said "enviarla de vuelta". 
            // I'll show success and close.
            setSelectedAgent(null); 
        } catch (err) {
            console.error("Error saving suggestion:", err);
            setError("Error al guardar la sugerencia.");
        } finally {
            setSaving(false);
        }
    };

    const filteredAgents = agents.filter(agent => 
        agent.agente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.correo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-m3-primary" size={32} />
        </div>
    );

    return (
        <div className="flex h-full gap-6">
            {/* Main Table Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Directorio de Agentes</h3>
                        <p className="text-sm text-gray-500">Visualiza y gestiona el rendimiento del equipo.</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o correo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 rounded-full border border-m3-surface-variant dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none min-w-[300px]"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto rounded-3xl border border-m3-surface-variant/30 bg-white dark:bg-[#1E1E1E] shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-m3-surface-variant/40 dark:bg-white/10 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider">Agente</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider">Correo</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">AHT Real</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">ATT</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">ACW</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">RES (%)</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">PSAT (%)</th>
                                <th className="p-4 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
                            {loading ? (
                                <tr><td colSpan={8} className="p-10 text-center text-gray-400">Cargando agentes...</td></tr>
                            ) : filteredAgents.length === 0 ? (
                                <tr><td colSpan={8} className="p-10 text-center text-gray-400">No se encontraron resultados.</td></tr>
                            ) : (
                                filteredAgents.map((agent) => (
                                    <tr
                                        key={agent.id}
                                        className={`group hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-colors cursor-pointer ${selectedAgent?.id === agent.id ? 'bg-m3-primary/10 dark:bg-m3-primary/20' : ''}`}
                                        onClick={() => handleSelectAgent(agent)}
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-m3-primary/10 flex items-center justify-center text-m3-primary font-bold text-xs">
                                                    {(agent.agente || agent.name) ? (agent.agente || agent.name).substring(0, 2).toUpperCase() : <User size={14} />}
                                                </div>
                                                <span className="font-medium text-m3-secondary dark:text-m3-on-surface-dark">{agent.agente || agent.name || "N/A"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                            {agent.correo || agent.email}
                                        </td>
                                        <td className="p-4 text-center text-sm">
                                            {agent['AHT Real'] || 'N/A'}
                                        </td>
                                        <td className="p-4 text-center text-sm">
                                            {agent.ATT || 'N/A'}
                                        </td>
                                        <td className="p-4 text-center text-sm">
                                            {agent.ACW || 'N/A'}
                                        </td>
                                        <td className="p-4 text-center font-medium text-m3-secondary dark:text-m3-on-surface-dark">
                                            {agent.RES || 'N/A'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${parseFloat(agent.PSAT || '0') < 80 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                                {agent.PSAT || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="p-2 hover:bg-m3-primary/10 rounded-full text-m3-primary transition-colors">
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

             {selectedAgent && (
                <div className="w-96 bg-white dark:bg-[#1E1E1E] border-l border-m3-surface-variant/30 dark:border-white/10 flex flex-col shadow-xl animate-in slide-in-from-right duration-300 z-20">
                    <div className="p-6 border-b border-m3-surface-variant/30 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-m3-secondary dark:text-white">Detalle del Agente</h2>
                        <button onClick={() => setSelectedAgent(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} className="text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto bg-m3-primary/10 dark:bg-m3-primary/20 rounded-full flex items-center justify-center text-3xl font-bold text-m3-primary mb-3">
                                {(selectedAgent.agente || selectedAgent.name) ? (selectedAgent.agente || selectedAgent.name).substring(0,2).toUpperCase() : <User />}
                            </div>
                            <h3 className="text-xl font-bold text-m3-secondary dark:text-white">{selectedAgent.agente || selectedAgent.name}</h3>
                            <p className="text-sm text-gray-500">{selectedAgent.correo || selectedAgent.email}</p>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-m3-surface-variant/20 dark:bg-white/5 text-center">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Precisión</span>
                                <p className={`text-2xl font-bold text-m3-primary`}>{calculateAccuracy()}%</p>
                            </div>
                             <div className="p-4 rounded-2xl bg-m3-surface-variant/20 dark:bg-white/5 text-center">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Quizzes</span>
                                <p className="text-2xl font-bold text-m3-secondary dark:text-white">{agentResults.length}</p>
                            </div>
                        </div>

                        {/* Feedback Section */}
                        <div>
                            <label className="block text-sm font-bold text-m3-secondary dark:text-white mb-2 flex items-center gap-2">
                                <Edit3 size={16} /> Sugerencia / Feedback
                            </label>
                            <textarea 
                                value={suggestion}
                                onChange={(e) => setSuggestion(e.target.value)}
                                className="w-full h-32 p-4 rounded-xl border border-m3-surface-variant/50 dark:border-white/10 bg-m3-surface dark:bg-[#2C2C2C] focus:ring-2 focus:ring-m3-primary outline-none resize-none text-m3-secondary dark:text-white text-sm leading-relaxed"
                                placeholder="Escribe un feedback constructivo para este agente..."
                            />
                             <button 
                                onClick={handleSaveSuggestion}
                                disabled={saving}
                                className="mt-2 w-full py-2 rounded-xl font-bold bg-m3-primary text-white hover:bg-md-primary/90 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Guardar Feedback
                            </button>
                        </div>

                         {/* NEW: Quiz Performance Section */}
                         <div>
                             <h3 className="font-bold text-m3-secondary dark:text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={18} />
                                Rendimiento en Quizzes
                             </h3>

                             {resultsLoading ? (
                                 <div className="flex justify-center py-8">
                                     <Loader2 className="animate-spin text-m3-primary" />
                                 </div>
                             ) : agentResults.length === 0 ? (
                                 <p className="text-center text-gray-400 text-sm py-4">No ha realizado quizzes aún.</p>
                             ) : (
                                 <div className="space-y-3">
                                     {agentResults.map((result) => (
                                         <div key={result.id} className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5 relative group">
                                             {/* Header: Quiz Name & Status */}
                                             <div className="flex justify-between items-start mb-3">
                                                 <div className="pr-6">
                                                     <p className="text-sm font-bold text-m3-secondary dark:text-white line-clamp-2">
                                                         {quizMap[result.quizId] || 'Quiz Eliminado'}
                                                     </p>
                                                     <p className="text-xs text-gray-500 mt-1">
                                                         {result.timestamp?.toDate().toLocaleDateString()}
                                                     </p>
                                                 </div>
                                                 <div className={`p-1.5 rounded-full ${result.isCorrect ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                     {result.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                                 </div>
                                             </div>

                                             {/* Audio Player */}
                                             {result.audioUrl && (
                                                 <div className="mb-3">
                                                     <audio src={result.audioUrl} controls className="w-full h-8" />
                                                 </div>
                                             )}

                                             {/* Action: Reset */}
                                             <button 
                                                 onClick={() => deleteResult(result.id)}
                                                 className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                             >
                                                 <RefreshCw size={14} />
                                                 Habilitar Nueva Oportunidad
                                             </button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
