import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { appId, db, auth } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { Loader2, CheckCircle, AlertCircle, Send, Users, FileText, Building2 } from 'lucide-react';

export default function AdminQuizAssigner({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
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
                 const quizzesSnapshot = await getDocs(getPublicCollection('quizzes'));
                 const quizzesList = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                 setQuizzes(quizzesList);

                 // 2. Fetch Registered Users from Firestore
                 const usersSnapshot = await getDocs(collection(db, 'artifacts', appId, 'users'));
                 const usersList = usersSnapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    email: doc.data().email || '',
                    displayName: doc.data().displayName || doc.data().name || doc.data().agente || 'Usuario sin nombre',
                    lob: doc.data().lob || doc.data().lobId || 'phone'
                 }));
                 setAgents(usersList);
             } catch (err) {
                 console.error("Error fetching data:", err);
                 setError("Error al cargar datos operativos.");
             } finally {
                 setLoadingData(false);
             }
        };
        fetchData();
    }, [globalLobFilter]);

    // ── Integrated Filtering ──
    const filteredQuizzes = quizzes.filter(q => {
        if (globalLobFilter && globalLobFilter !== 'all') {
            return (q.lobId || 'phone') === globalLobFilter;
        }
        return true;
    });

    const filteredAgents = agents.filter(a => {
        if (globalLobFilter && globalLobFilter !== 'all') {
            return (a.lob || 'phone') === globalLobFilter;
        }
        return true;
    });

    const toggleAgentSelection = (email: string) => {
        if (!email) return;
        setSelectedAgentEmails(prev => 
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const handleAssign = async () => {
        if (!selectedQuizId) { setError("Debes seleccionar un peritaje."); return; }
        if (assignationType === 'specific' && selectedAgentEmails.length === 0) {
             setError("Debes seleccionar al menos un agente."); return;
        }

        setIsAssigning(true); setError(null); setSuccess(false);

        try {
            const targets = assignationType === 'all' 
                ? filteredAgents 
                : filteredAgents.filter(a => selectedAgentEmails.includes(a.email));

            const assignmentsUpdates = targets.map(agent => {
                return addDoc(getPublicCollection('asignaciones_quizzes'), {
                    quizId: selectedQuizId,
                    agentEmail: agent.email,
                    agentName: agent.displayName,
                    assignedAt: serverTimestamp(),
                    status: 'pending',
                    assignedBy: auth.currentUser?.email
                });
            });

            await Promise.all(assignmentsUpdates);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            if (assignationType === 'specific') setSelectedAgentEmails([]);
        } catch (err) {
            setError("Hubo un error al realizar el despliegue.");
        } finally {
            setIsAssigning(false);
        }
    };

    if (loadingData) return (
        <div className="flex flex-col items-center justify-center p-32 gap-4">
             <Loader2 className="animate-spin text-m3-primary" size={40} />
             <p className="text-[10px] font-black uppercase text-gray-400">Preparando Consola de Despliegue...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-600">
            {/* Header Specialist */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] border border-m3-surface-variant/30 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-orange-600/10 rounded-[28px] ring-8 ring-orange-600/5">
                        <Send className="text-orange-600" size={32} />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-m3-secondary dark:text-white leading-tight">Módulo de Despliegue</h3>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-2">Distribución de Peritajes Operativos</p>
                    </div>
                </div>

                {globalLobFilter !== 'all' && (
                    <div className="flex items-center gap-3 px-6 py-3 bg-m3-primary/10 rounded-2xl border border-m3-primary/20">
                        <Building2 size={16} className="text-m3-primary" />
                        <span className="text-[10px] font-black text-m3-primary uppercase tracking-widest leading-none">Segmento: {globalLobFilter}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
                {/* 1. Select Quiz */}
                <div className="lg:col-span-5 space-y-8">
                    <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] border border-m3-surface-variant/30 shadow-xl">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-m3-primary text-white flex items-center justify-center text-[10px]">1</span>
                            Seleccionar Peritaje
                        </h4>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
                             {filteredQuizzes.map(quiz => (
                                 <div 
                                    key={quiz.id}
                                    onClick={() => setSelectedQuizId(quiz.id)}
                                    className={`p-5 rounded-3xl border-2 transition-all group cursor-pointer ${selectedQuizId === quiz.id 
                                        ? 'border-m3-primary bg-m3-primary/5 dark:bg-m3-primary/20 shadow-lg shadow-m3-primary/10 scale-[1.02]' 
                                        : 'border-m3-surface-variant/20 hover:border-m3-primary/40 dark:border-white/5'}`}
                                 >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-black text-sm text-m3-secondary dark:text-white uppercase leading-tight line-clamp-1">{quiz.situation}</p>
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${quiz.lobId === 'recupero' ? 'bg-orange-100/50 text-orange-600' : 'bg-blue-100/50 text-blue-600'}`}>
                                            {quiz.lobId || 'phone'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-medium text-gray-500 leading-relaxed italic line-clamp-2">{quiz.question}</p>
                                 </div>
                             ))}
                             {filteredQuizzes.length === 0 && (
                                 <div className="p-10 text-center rounded-3xl border-2 border-dashed border-gray-100 dark:border-white/5 opacity-40">
                                     <p className="text-[10px] font-black uppercase text-gray-400">No hay peritajes en este segmento</p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>

                {/* 2. Select Target */}
                <div className="lg:col-span-4">
                    <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] border border-m3-surface-variant/30 shadow-xl h-full flex flex-col">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-m3-primary text-white flex items-center justify-center text-[10px]">2</span>
                            Destinatarios
                        </h4>
                        
                        <div className="flex p-1.5 bg-m3-surface-variant/10 rounded-2xl mb-6">
                             <button 
                                onClick={() => setAssignationType('all')}
                                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${assignationType === 'all' 
                                    ? 'bg-m3-primary text-white shadow-lg' 
                                    : 'text-gray-500 hover:text-m3-primary'}`}
                             >
                                Global ({filteredAgents.length})
                             </button>
                             <button 
                                onClick={() => setAssignationType('specific')}
                                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${assignationType === 'specific' 
                                    ? 'bg-m3-primary text-white shadow-lg' 
                                    : 'text-gray-500 hover:text-m3-primary'}`}
                             >
                                Selección
                             </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar max-h-[500px]">
                            {assignationType === 'specific' ? (
                                <div className="space-y-2">
                                    {filteredAgents.map((agent) => (
                                        <label 
                                            key={agent.email}
                                            className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedAgentEmails.includes(agent.email) 
                                                ? 'bg-m3-primary/5 border-m3-primary/30 shadow-inner' 
                                                : 'border-transparent hover:bg-m3-surface-variant/10'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedAgentEmails.includes(agent.email) ? 'bg-m3-primary border-m3-primary text-white' : 'border-m3-surface-variant/40 bg-white dark:bg-black/20'}`}>
                                                {selectedAgentEmails.includes(agent.email) && <CheckCircle size={12} />}
                                            </div>
                                            <input type="checkbox" checked={selectedAgentEmails.includes(agent.email)} onChange={() => toggleAgentSelection(agent.email)} className="hidden" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-m3-secondary dark:text-white uppercase truncate">{agent.displayName}</p>
                                                <p className="text-[9px] text-gray-500 font-bold truncate mt-1">{agent.email}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                                    <Users size={48} className="text-gray-300" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Totalidad del segmento operativa seleccionada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Summary & Action */}
                <div className="lg:col-span-3">
                    <div className="bg-m3-primary/5 dark:bg-black/40 p-10 rounded-[48px] border border-m3-primary/20 h-full flex flex-col justify-between shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <Send size={120} className="text-m3-primary" />
                        </div>
                        
                        <div className="relative z-10">
                            <h4 className="text-[10px] font-black text-m3-primary uppercase tracking-[0.2em] mb-8">Confirmación de Carga</h4>
                            
                            <div className="space-y-6">
                                <div>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Módulo Destino</span>
                                    <p className="text-sm font-black text-m3-secondary dark:text-white uppercase mt-2 line-clamp-2">
                                        {quizzes.find(q => q.id === selectedQuizId)?.situation || "Pendiente..."}
                                    </p>
                                </div>
                                <div className="h-px bg-m3-primary/10" />
                                <div>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Población Impactada</span>
                                    <p className="text-4xl font-black text-m3-primary mt-2">
                                        {assignationType === 'all' ? filteredAgents.length : selectedAgentEmails.length}
                                    </p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase mt-1">Colaboradores registrados</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 space-y-4 relative z-10">
                            {error && <div className="p-4 bg-rose-50 text-rose-600 font-bold rounded-2xl text-[10px] flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                            {success && <div className="p-4 bg-emerald-50 text-emerald-600 font-bold rounded-2xl text-[10px] flex items-center gap-2 animate-bounce"><CheckCircle size={16} /> Sincronización Exitosa</div>}

                            <button 
                                onClick={handleAssign}
                                disabled={isAssigning || !selectedQuizId || (assignationType === 'specific' && selectedAgentEmails.length === 0)}
                                className={`w-full py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.3em] text-white flex items-center justify-center gap-3 transition-all shadow-xl
                                    ${isAssigning ? 'bg-gray-400' : 'bg-m3-primary hover:bg-blue-700 hover:scale-[1.02] shadow-m3-primary/40'}
                                `}
                            >
                                {isAssigning ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                Desplegar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
