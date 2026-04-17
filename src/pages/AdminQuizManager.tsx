import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';import { getPublicCollection, getPublicDoc, getAppStorageRef } from '../firebasePaths';

import { Loader2, Pencil, Trash2, Users, X, CheckCircle, AlertCircle, Upload, ChevronDown, ChevronUp, FileText, Building2 } from 'lucide-react';

export default function AdminQuizManager({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Editing State
    const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [newAudioFile, setNewAudioFile] = useState<File | null>(null);
    const [lobs, setLobs] = useState<any[]>([]);

    // Assignments State
    const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);

    useEffect(() => {
        fetchQuizzes();
        fetchLobs();
    }, [globalLobFilter]);

    const fetchLobs = async () => {
        try {
            const snap = await getDocs(getPublicCollection('lobs'));
            setLobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
    };

    const fetchQuizzes = async () => {
        setLoadingQuizzes(true);
        try {
            const q = query(getPublicCollection('quizzes'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error("Error fetching quizzes:", err);
            setError("Error al cargar los quizzes.");
        } finally {
            setLoadingQuizzes(false);
        }
    };

    const handleDeleteQuiz = async (quiz: any) => {
        if (!window.confirm(`¿Seguro que quieres eliminar el quiz "${quiz.situation}"?`)) return;
        try {
            await deleteDoc(getPublicDoc('quizzes', quiz.id));
            if (quiz.audioUrl) {
                try { await deleteObject(getAppStorageRef(quiz.audioUrl)); } catch (e) { console.warn(e); }
            }
            showSuccess("Quiz eliminado correctamente.");
            fetchQuizzes();
        } catch (err) {
            setError("Error al eliminar el quiz.");
        }
    };

    const handleUpdateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingQuiz) return;
        setIsSaving(true); setError(null);
        try {
            let audioUrl = editingQuiz.audioUrl || '';
            if (newAudioFile) {
                const storageRef = getAppStorageRef(`quizzes/audio/${Date.now()}_${newAudioFile.name}`);
                const snapshot = await uploadBytes(storageRef, newAudioFile);
                audioUrl = await getDownloadURL(snapshot.ref);
                if (editingQuiz.audioUrl) {
                    try { await deleteObject(getAppStorageRef(editingQuiz.audioUrl)); } catch (e) { }
                }
            }
            const updatedData = { ...editingQuiz, audioUrl, updatedAt: serverTimestamp() };
            delete updatedData.id;
            await updateDoc(getPublicDoc('quizzes', editingQuiz.id), updatedData);
            showSuccess("Quiz actualizado correctamente.");
            setEditingQuiz(null); setNewAudioFile(null);
            fetchQuizzes();
        } catch (err) {
            setError("Error al actualizar el quiz.");
        } finally { setIsSaving(false); }
    };

    const fetchAssignments = async (quizId: string) => {
        setLoadingAssignments(true);
        try {
            const q = query(getPublicCollection('asignaciones_quizzes'), where('quizId', '==', quizId));
            const snapshot = await getDocs(q);
            setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            setError("Error al cargar asignaciones.");
        } finally { setLoadingAssignments(false); }
    };

    const toggleExpand = (quizId: string) => {
        if (expandedQuizId === quizId) { setExpandedQuizId(null); setAssignments([]); }
        else { setExpandedQuizId(quizId); fetchAssignments(quizId); }
    };

    const handleRevokeAssignment = async (assignmentId: string) => {
        if (!window.confirm("¿Seguro que quieres revocar esta asignación?")) return;
        try {
            await deleteDoc(getPublicDoc('asignaciones_quizzes', assignmentId));
            setAssignments(prev => prev.filter(a => a.id !== assignmentId));
            showSuccess("Asignación revocada.");
        } catch (err) { setError("Error al revocar asignación."); }
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // ── Integrated Filtering ──
    const filteredQuizzes = quizzes.filter(q => {
        if (globalLobFilter && globalLobFilter !== 'all') {
            return (q.lobId || 'phone') === globalLobFilter;
        }
        return true;
    });

    if (loadingQuizzes) return (
        <div className="flex flex-col items-center justify-center p-32 gap-4">
            <Loader2 className="animate-spin text-m3-primary" size={40} />
            <p className="text-[10px] font-black uppercase text-gray-400">Auditoría de Peritajes...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-white dark:bg-[#1E1E1E] p-6 rounded-[32px] border border-m3-surface-variant/30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-m3-primary/10 rounded-[24px] ring-4 ring-m3-primary/5">
                        <FileText className="text-m3-primary" size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-m3-secondary dark:text-white leading-tight">Gestión de Peritajes</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Control de Evaluaciones Operativas</p>
                    </div>
                </div>
            </div>

            {error && <div className="p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 font-bold rounded-2xl text-xs flex items-center gap-2 shadow-sm"><AlertCircle size={18} /> {error}</div>}
            {successMessage && <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 font-bold rounded-2xl text-xs flex items-center gap-2 shadow-sm"><CheckCircle size={18} /> {successMessage}</div>}

            {/* Quizzes Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredQuizzes.length === 0 ? (
                    <div className="p-20 text-center bg-gray-50 dark:bg-white/[0.02] rounded-[40px] border-2 border-dashed border-gray-100 dark:border-white/5">
                        <Users className="mx-auto text-gray-300 mb-6 opacity-40" size={64} />
                        <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest italic">Cero evaluaciones configuradas en esta área</p>
                    </div>
                ) : filteredQuizzes.map(quiz => (
                    <div key={quiz.id} className="group bg-white dark:bg-[#1E1E1E] border border-m3-surface-variant/30 dark:border-white/10 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-inner ${quiz.lobId === 'recupero' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {quiz.lobId || 'phone'}
                                    </span>
                                    <span className="text-[9px] font-black text-gray-400 uppercase">UID: {quiz.id.slice(-8)}</span>
                                </div>
                                <h4 className="text-xl font-black text-m3-secondary dark:text-white truncate mb-1">{quiz.situation}</h4>
                                <p className="text-sm text-gray-500 font-medium line-clamp-1">{quiz.question}</p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => toggleExpand(quiz.id)}
                                    className={`flex items-center gap-2 py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${expandedQuizId === quiz.id ? 'bg-m3-primary text-white scale-105' : 'bg-m3-surface-variant/10 text-m3-secondary dark:text-gray-300 border border-m3-surface-variant/30'}`}
                                >
                                    <Users size={16} /> 
                                    Segmentos {expandedQuizId === quiz.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingQuiz(quiz)} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Pencil size={20} /></button>
                                    <button onClick={() => handleDeleteQuiz(quiz)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={20} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Expandable Assignments Section */}
                        {expandedQuizId === quiz.id && (
                            <div className="bg-m3-surface-variant/10 dark:bg-black/20 border-t border-m3-surface-variant/20 p-8 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between mb-6">
                                    <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Población con Acceso</h5>
                                    <div className="h-px flex-1 bg-m3-surface-variant/20 mx-4" />
                                </div>
                                {loadingAssignments ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-m3-primary" size={24} /></div>
                                ) : assignments.length === 0 ? (
                                    <div className="p-10 text-center rounded-3xl border-2 border-dashed border-gray-100 dark:border-white/5 opacity-40">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sin despliegues activos para este módulo</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {assignments.map(as => (
                                            <div key={as.id} className="group/item flex items-center justify-between p-4 bg-white dark:bg-[#252525] rounded-2xl border border-m3-surface-variant/20 shadow-sm hover:shadow-lg transition-all">
                                                <div className="min-w-0 pr-4">
                                                    <p className="text-xs font-black text-m3-secondary dark:text-white truncate leading-tight uppercase">{as.agentName || 'Agente'}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold truncate mt-1">{as.agentEmail}</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleRevokeAssignment(as.id)}
                                                    className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-40 group-hover/item:opacity-100"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Edit Modal (Overlay) */}
            {editingQuiz && (
                <div className="fixed inset-0 bg-m3-secondary/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                    <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-m3-surface-variant/20 flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
                            <div>
                                <h4 className="text-2xl font-black text-m3-secondary dark:text-white">Editor de Evaluación</h4>
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Refactorización de Escenario Policial</p>
                            </div>
                            <button onClick={() => setEditingQuiz(null)} className="p-3 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded-2xl transition-all"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleUpdateQuiz} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Situación / Título</label>
                                    <input type="text" value={editingQuiz.situation} onChange={e => setEditingQuiz({...editingQuiz, situation: e.target.value})} className="w-full px-4 py-3 rounded-2xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant/30 font-bold focus:ring-2 focus:ring-m3-primary transition-all dark:text-white outline-none" required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">LOB (Propiedad)</label>
                                    <select value={editingQuiz.lobId || ''} onChange={e => setEditingQuiz({...editingQuiz, lobId: e.target.value})} className="w-full px-4 py-3 rounded-2xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant/30 font-bold focus:ring-2 focus:ring-m3-primary transition-all dark:text-white outline-none">
                                        {lobs.length === 0 ? (
                                            <option value="">Cargando áreas...</option>
                                        ) : (
                                            <>
                                                <option value="">Selecciona un Área...</option>
                                                {lobs.map(lob => <option key={lob.id} value={lob.id}>{lob.name}</option>)}
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Pregunta Ejecutiva</label>
                                <input type="text" value={editingQuiz.question} onChange={e => setEditingQuiz({...editingQuiz, question: e.target.value})} className="w-full px-4 py-3 rounded-2xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant/30 font-bold focus:ring-2 focus:ring-m3-primary transition-all dark:text-white outline-none" required />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-m3-surface-variant/20">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Configuración de Opciones</label>
                                {editingQuiz.options.map((opt: any, idx: number) => (
                                    <div key={opt.id} className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-2 pr-4 rounded-2xl group/opt border border-transparent hover:border-m3-primary/30 transition-all">
                                        <div className="w-10 h-10 rounded-xl bg-m3-primary/10 flex items-center justify-center font-black text-m3-primary text-sm group-hover/opt:bg-m3-primary group-hover/opt:text-white transition-all">{opt.id}</div>
                                        <input 
                                            type="text" value={opt.text}
                                            onChange={e => {
                                                const newOptions = [...editingQuiz.options];
                                                newOptions[idx].text = e.target.value;
                                                setEditingQuiz({...editingQuiz, options: newOptions});
                                            }}
                                            className="flex-1 bg-transparent border-none text-sm font-bold text-m3-secondary dark:text-white outline-none" required
                                        />
                                        <input type="radio" name="correct" checked={editingQuiz.correctOption === opt.id} onChange={() => setEditingQuiz({...editingQuiz, correctOption: opt.id})} className="w-5 h-5 accent-m3-primary shadow-sm" />
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Asset de Voz (Contexto)</label>
                                <div className="flex items-center gap-4 p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-dashed border-indigo-200 dark:border-indigo-900/40 relative group">
                                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform"><Upload size={20} /></div>
                                    <p className="text-xs font-black uppercase text-indigo-600 truncate flex-1">{newAudioFile ? newAudioFile.name : editingQuiz.audioUrl ? "Audio Sincronizado (Click para cambiar)" : "No disponible"}</p>
                                    <input type="file" accept="audio/*" onChange={e => e.target.files?.[0] && setNewAudioFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Matriz de Retroalimentación</label>
                                <textarea value={editingQuiz.explanation} onChange={e => setEditingQuiz({...editingQuiz, explanation: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant/30 font-bold focus:ring-2 focus:ring-m3-primary transition-all dark:text-white outline-none resize-none" required />
                            </div>

                            <button type="submit" disabled={isSaving} className="w-full py-4 rounded-2xl bg-m3-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:shadow-m3-primary/30 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                                {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                                Guardar Peritaje
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
