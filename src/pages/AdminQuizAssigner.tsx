import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { getAllAgents } from '../api/sheetService';
import { Loader2, CheckCircle, AlertCircle, Send, Users, User, FileText } from 'lucide-react';

export default function AdminQuizAssigner() {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [agents, setAgents] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    
    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [assignationType, setAssignationType] = useState<'all' | 'specific'>('all');
    const [selectedAgentEmails, setSelectedAgentEmails] = useState<string[]>([]);
    
    const [isAssigning, setIsAssigning] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
             setLoadingData(true);
             try {
                 // 1. Fetch Quizzes
                 const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
                 const quizzesList = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                 setQuizzes(quizzesList);

                 // 2. Fetch Agents
                 const agentsList = await getAllAgents();
                 setAgents(Array.isArray(agentsList) ? agentsList : []);
             } catch (err) {
                 console.error("Error fetching data:", err);
                 setError("Error al cargar datos necesarios.");
             } finally {
                 setLoadingData(false);
             }
        };
        fetchData();
    }, []);

    const toggleAgentSelection = (email: string) => {
        setSelectedAgentEmails(prev => 
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const handleAssign = async () => {
        if (!selectedQuizId) {
            setError("Debes seleccionar un Quiz.");
            return;
        }
        if (assignationType === 'specific' && selectedAgentEmails.length === 0) {
             setError("Debes seleccionar al menos un agente.");
             return;
        }

        setIsAssigning(true);
        setError(null);
        setSuccess(false);

        try {
            const targets = assignationType === 'all' 
                ? agents 
                : agents.filter(a => selectedAgentEmails.includes(a.correo));

            const assignmentsUpdates = targets.map(agent => {
                return addDoc(collection(db, 'asignaciones_quizzes'), {
                    quizId: selectedQuizId,
                    quizId: selectedQuizId,
                    agentEmail: agent.correo,
                    agentName: agent.agente || 'Agente',
                    assignedAt: serverTimestamp(),
                    status: 'pending',
                    assignedBy: auth.currentUser?.email
                });
            });

            await Promise.all(assignmentsUpdates);
            
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            
            // Reset selection if specific? Maybe keep it.
            if (assignationType === 'specific') setSelectedAgentEmails([]);
            
        } catch (err) {
            console.error("Error assigning quizzes:", err);
            setError("Hubo un error al asignar los quizzes.");
        } finally {
            setIsAssigning(false);
        }
    };

    if (loadingData) return (
        <div className="flex justify-center items-center h-64">
             <Loader2 className="animate-spin text-m3-primary" size={32} />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-full">
                    <Send className="text-orange-600 dark:text-orange-400" size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Asignador de Quizzes</h3>
                    <p className="text-sm text-gray-500">Distribuye evaluaciones a tu equipo.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Configuration */}
                <div className="space-y-6">
                    {/* 1. Select Quiz */}
                    <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[24px] border border-m3-surface-variant/30 shadow-sm">
                        <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-4 flex items-center gap-2">
                            <FileText size={18} /> 1. Selecciona un Quiz
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                             {quizzes.map(quiz => (
                                 <div 
                                    key={quiz.id}
                                    onClick={() => setSelectedQuizId(quiz.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedQuizId === quiz.id 
                                        ? 'border-m3-primary bg-m3-primary/5 dark:bg-m3-primary/20' 
                                        : 'border-m3-surface-variant/50 hover:bg-gray-50 dark:hover:bg-white/5 dark:border-white/10'}`}
                                 >
                                    <p className="font-medium text-sm text-m3-secondary dark:text-m3-on-surface-dark truncate">{quiz.situation}</p>
                                    <p className="text-xs text-gray-400">{quiz.question}</p>
                                 </div>
                             ))}
                             {quizzes.length === 0 && <p className="text-gray-400 text-sm">No hay quizzes disponibles.</p>}
                        </div>
                    </div>

                    {/* 2. Select Target */}
                    <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[24px] border border-m3-surface-variant/30 shadow-sm">
                        <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-4 flex items-center gap-2">
                            <Users size={18} /> 2. Destinatarios
                        </h4>
                        <div className="flex gap-4 mb-4">
                             <button 
                                onClick={() => setAssignationType('all')}
                                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${assignationType === 'all' 
                                    ? 'bg-m3-primary text-white shadow-md' 
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'}`}
                             >
                                Todos ({agents.length})
                             </button>
                             <button 
                                onClick={() => setAssignationType('specific')}
                                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${assignationType === 'specific' 
                                    ? 'bg-m3-primary text-white shadow-md' 
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'}`}
                             >
                                Seleccionar
                             </button>
                        </div>

                        {assignationType === 'specific' && (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {agents.map((agent, index) => (
                                    <label 
                                        key={agent.correo || `agent-${index}`}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${agent.correo && selectedAgentEmails.includes(agent.correo) 
                                            ? 'bg-m3-primary/5 border-m3-primary/30 dark:bg-m3-primary/10 dark:border-m3-primary/30' 
                                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={!!agent.correo && selectedAgentEmails.includes(agent.correo)}
                                            onChange={() => agent.correo && toggleAgentSelection(agent.correo)}
                                            className="w-5 h-5 rounded text-m3-primary focus:ring-m3-primary"
                                        />
                                        <div className="overflow-hidden flex-1">
                                            <p className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark truncate">{agent.agente || agent.nombre || "Sin Nombre"}</p>
                                            <p className="text-xs text-gray-500 truncate">{agent.correo || "Sin Correo"}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Confirmation & Action */}
                <div className="flex flex-col">
                    <div className="bg-m3-surface-variant/20 dark:bg-black/20 p-6 rounded-[24px] border border-m3-surface-variant/30 flex-1 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-6">Resumen de Asignación</h4>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <span className="text-sm text-gray-500">Quiz Seleccionado</span>
                                    <span className="text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark text-right max-w-[150px]">
                                        {quizzes.find(q => q.id === selectedQuizId)?.situation || "Ninguno"}
                                    </span>
                                </div>
                                <div className="w-full h-px bg-m3-surface-variant dark:bg-white/10" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Total Agentes</span>
                                    <span className="text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark">
                                        {assignationType === 'all' ? agents.length : selectedAgentEmails.length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                             {success && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    ¡Asignación completada!
                                </div>
                            )}

                            <button 
                                onClick={handleAssign}
                                disabled={isAssigning || !selectedQuizId || (assignationType === 'specific' && selectedAgentEmails.length === 0)}
                                className="w-full py-4 rounded-xl font-bold bg-m3-primary text-white shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isAssigning ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                Asignar Ahora
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
