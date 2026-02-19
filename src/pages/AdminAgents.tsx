import { useState, useEffect } from 'react';
import { Search, Edit3, Save, X, Loader2, ChevronRight, User } from 'lucide-react';
import { getAllAgents, updateAgentSuggestion } from '../api/sheetService';

export default function AdminAgents() {
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
    const [suggestion, setSuggestion] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAgents();
    }, []);

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

    const handleSelectAgent = (agent: any) => {
        setSelectedAgent(agent);
        setSuggestion(agent.sugerencia || '');
        setError(null);
    };

    const handleSaveSuggestion = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        try {
            await updateAgentSuggestion(selectedAgent.correo, suggestion);
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
                            {filteredAgents.map((agent, idx) => (
                                <tr 
                                    key={idx} 
                                    className="group hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => handleSelectAgent(agent)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-m3-primary/10 flex items-center justify-center text-m3-primary font-bold text-xs">
                                                {agent.agente ? agent.agente.substring(0,2).toUpperCase() : <User size={14} />}
                                            </div>
                                            <span className="font-medium text-m3-secondary dark:text-m3-on-surface-dark">{agent.agente || "N/A"}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        {agent.correo}
                                    </td>
                                    <td className="p-4 text-center text-sm">
                                        {agent['AHT Real']}
                                    </td>
                                    <td className="p-4 text-center text-sm">
                                        {agent.ATT}
                                    </td>
                                    <td className="p-4 text-center text-sm">
                                        {agent.ACW}
                                    </td>
                                    <td className="p-4 text-center font-medium text-m3-secondary dark:text-m3-on-surface-dark">
                                        {agent.RES}
                                    </td>
                                    <td className="p-4 text-center">
                                       <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${parseFloat(agent.PSAT) < 80 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                            {agent.PSAT}
                                       </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-2 hover:bg-m3-primary/10 rounded-full text-m3-primary transition-colors">
                                            <ChevronRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredAgents.length === 0 && (
                        <div className="p-10 text-center text-gray-400">
                            No se encontraron resultados.
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Panel (Side Sheet) */}
            {selectedAgent && (
                <div className="w-96 bg-white dark:bg-[#1E1E1E] border-l border-m3-surface-variant/30 flex flex-col shadow-xl animate-in slide-in-from-right duration-300 z-20">
                    <div className="p-6 border-b border-m3-surface-variant/30 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-m3-secondary dark:text-m3-on-surface-dark">Detalle del Agente</h2>
                        <button onClick={() => setSelectedAgent(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto bg-m3-primary/10 rounded-full flex items-center justify-center text-3xl font-bold text-m3-primary mb-3">
                                {selectedAgent.nombre || selectedAgent.agente ? (selectedAgent.nombre || selectedAgent.agente).substring(0,2).toUpperCase() : <User />}
                            </div>
                            <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">{selectedAgent.nombre || selectedAgent.agente}</h3>
                            <p className="text-sm text-gray-500">{selectedAgent.correo}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-m3-surface-variant/20 dark:bg-white/5 text-center">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">PSAT</span>
                                <p className={`text-2xl font-bold ${parseFloat(selectedAgent.PSAT) < 80 ? 'text-red-500' : 'text-emerald-500'}`}>{selectedAgent.PSAT}</p>
                            </div>
                             <div className="p-4 rounded-2xl bg-m3-surface-variant/20 dark:bg-white/5 text-center">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">RES</span>
                                <p className="text-2xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">{selectedAgent.RES}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-2 flex items-center gap-2">
                                <Edit3 size={16} /> Sugerencia / Feedback
                            </label>
                            <textarea 
                                value={suggestion}
                                onChange={(e) => setSuggestion(e.target.value)}
                                className="w-full h-40 p-4 rounded-xl border border-m3-surface-variant/50 dark:border-white/10 bg-m3-surface dark:bg-[#2C2C2C] focus:ring-2 focus:ring-m3-primary outline-none resize-none text-m3-secondary dark:text-m3-on-surface-dark text-sm leading-relaxed"
                                placeholder="Escribe un feedback constructivo para este agente..."
                            />
                            <p className="text-xs text-gray-400 mt-2">Esta sugerencia se actualizará en la base de datos.</p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-m3-surface-variant/30 bg-gray-50 dark:bg-black/20">
                         <button 
                            onClick={handleSaveSuggestion}
                            disabled={saving}
                            className="w-full py-3 rounded-full font-bold bg-m3-primary text-white hover:bg-blue-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            Guardar Feedback
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
