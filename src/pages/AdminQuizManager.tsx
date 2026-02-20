import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { Loader2, Pencil, Trash2, Users, X, CheckCircle, AlertCircle, Upload, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export default function AdminQuizManager() {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Editing State
    const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [newAudioFile, setNewAudioFile] = useState<File | null>(null);

    // Assignments State
    const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        setLoadingQuizzes(true);
        try {
            const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
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
        if (!window.confirm(`¿Seguro que quieres eliminar el quiz "${quiz.situation}"? This will NOT remove existing assignments unless manually revoked.`)) return;
        
        try {
            await deleteDoc(doc(db, 'quizzes', quiz.id));
            if (quiz.audioUrl) {
                try {
                    const audioRef = ref(storage, quiz.audioUrl);
                    await deleteObject(audioRef);
                } catch (e) {
                    console.warn("Could not delete audio from storage", e);
                }
            }
            showSuccess("Quiz eliminado correctamente.");
            fetchQuizzes();
        } catch (err) {
            console.error("Error deleting quiz:", err);
            setError("Error al eliminar el quiz.");
        }
    };

    const handleUpdateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingQuiz) return;
        
        setIsSaving(true);
        setError(null);

        try {
            let audioUrl = editingQuiz.audioUrl || '';
            
            if (newAudioFile) {
                const storageRef = ref(storage, `quizzes/audio/${Date.now()}_${newAudioFile.name}`);
                const snapshot = await uploadBytes(storageRef, newAudioFile);
                audioUrl = await getDownloadURL(snapshot.ref);
                
                // Optional: Delete old audio if it exists
                if (editingQuiz.audioUrl) {
                    try {
                        await deleteObject(ref(storage, editingQuiz.audioUrl));
                    } catch (e) { console.warn("Old audio not deleted", e); }
                }
            }

            const updatedData = {
                ...editingQuiz,
                audioUrl,
                updatedAt: serverTimestamp(),
            };
            delete updatedData.id;

            await updateDoc(doc(db, 'quizzes', editingQuiz.id), updatedData);
            
            showSuccess("Quiz actualizado correctamente.");
            setEditingQuiz(null);
            setNewAudioFile(null);
            fetchQuizzes();
        } catch (err) {
            console.error("Error updating quiz:", err);
            setError("Error al actualizar el quiz.");
        } finally {
            setIsSaving(false);
        }
    };

    const fetchAssignments = async (quizId: string) => {
        setLoadingAssignments(true);
        try {
            const q = query(collection(db, 'asignaciones_quizzes'), where('quizId', '==', quizId));
            const snapshot = await getDocs(q);
            setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error("Error fetching assignments:", err);
            setError("Error al cargar asignaciones.");
        } finally {
            setLoadingAssignments(false);
        }
    };

    const toggleExpand = (quizId: string) => {
        if (expandedQuizId === quizId) {
            setExpandedQuizId(null);
            setAssignments([]);
        } else {
            setExpandedQuizId(quizId);
            fetchAssignments(quizId);
        }
    };

    const handleRevokeAssignment = async (assignmentId: string) => {
        if (!window.confirm("¿Seguro que quieres revocar esta asignación? El usuario ya no podrá realizar este quiz.")) return;
        try {
            await deleteDoc(doc(db, 'asignaciones_quizzes', assignmentId));
            setAssignments(prev => prev.filter(a => a.id !== assignmentId));
            showSuccess("Asignación revocada.");
        } catch (err) {
            console.error("Error revoking assignment:", err);
            setError("Error al revocar asignación.");
        }
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    if (loadingQuizzes) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-m3-primary" size={32} />
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <Users className="text-blue-600 dark:text-blue-400" size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Gestión de Quizzes</h3>
                    <p className="text-sm text-gray-500">Edita, elimina y controla quién tiene acceso a cada evaluación.</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center gap-2">
                    <AlertCircle size={20} /> {error}
                </div>
            )}
            {successMessage && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-2xl flex items-center gap-2">
                    <CheckCircle size={20} /> {successMessage}
                </div>
            )}

            {/* Quizzes Table/List */}
            <div className="space-y-4">
                {quizzes.map(quiz => (
                    <div key={quiz.id} className="bg-white dark:bg-[#1E1E1E] border border-m3-surface-variant/30 dark:border-white/10 rounded-[24px] overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark truncate">{quiz.situation}</h4>
                                <p className="text-sm text-gray-500 truncate">{quiz.question}</p>
                                <div className="flex gap-4 mt-2">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                                        ID: {quiz.id.slice(-6)}
                                    </span>
                                    {quiz.audioUrl && (
                                         <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-2 py-0.5 rounded-full">
                                            Con Audio
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => toggleExpand(quiz.id)}
                                    className={`flex items-center gap-2 py-2 px-4 rounded-full text-xs font-bold transition-all ${expandedQuizId === quiz.id ? 'bg-m3-primary text-white' : 'bg-m3-surface-variant/30 text-m3-secondary dark:text-gray-300 dark:bg-white/5'}`}
                                >
                                    <Users size={16} /> Ver Asignaciones {expandedQuizId === quiz.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <button 
                                    onClick={() => setEditingQuiz(quiz)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteQuiz(quiz)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Expandable Assignments Section */}
                        {expandedQuizId === quiz.id && (
                            <div className="bg-m3-surface-variant/10 dark:bg-black/20 border-t border-m3-surface-variant/20 dark:border-white/5 p-6 animate-in slide-in-from-top-2 duration-300">
                                <h5 className="text-sm font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-4">Usuarios Asignados</h5>
                                {loadingAssignments ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-m3-primary" size={20} /></div>
                                ) : assignments.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No hay usuarios asignados a este quiz.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {assignments.map(as => (
                                            <div key={as.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#2C2C2C] rounded-xl border border-gray-100 dark:border-white/5">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-xs font-bold text-m3-secondary dark:text-white truncate">{as.agentName || 'Usuario'}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{as.agentEmail}</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleRevokeAssignment(as.id)}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                    title="Revocar Asignación"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {quizzes.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10">
                        <FileText className="mx-auto text-gray-300 mb-4" size={48} />
                        <p className="text-gray-500">No hay quizzes para gestionar. Crea uno primero.</p>
                    </div>
                )}
            </div>

            {/* Edit Modal (Overlay) */}
            {editingQuiz && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                            <h4 className="text-xl font-bold text-m3-secondary dark:text-white">Editar Quiz</h4>
                            <button onClick={() => setEditingQuiz(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateQuiz} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-500">Situación</label>
                                <input 
                                    type="text" 
                                    value={editingQuiz.situation}
                                    onChange={e => setEditingQuiz({...editingQuiz, situation: e.target.value})}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#2C2C2C] border-none focus:ring-2 focus:ring-m3-primary transition-all text-m3-secondary dark:text-white"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-500">Pregunta</label>
                                <input 
                                    type="text" 
                                    value={editingQuiz.question}
                                    onChange={e => setEditingQuiz({...editingQuiz, question: e.target.value})}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#2C2C2C] border-none focus:ring-2 focus:ring-m3-primary transition-all text-m3-secondary dark:text-white"
                                    required
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-500">Opciones</label>
                                {editingQuiz.options.map((opt: any, idx: number) => (
                                    <div key={opt.id} className="flex items-center gap-3">
                                        <span className="font-bold text-m3-primary dark:text-m3-primary-dark w-6">{opt.id}</span>
                                        <input 
                                            type="text"
                                            value={opt.text}
                                            onChange={e => {
                                                const newOptions = [...editingQuiz.options];
                                                newOptions[idx].text = e.target.value;
                                                setEditingQuiz({...editingQuiz, options: newOptions});
                                            }}
                                            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#2C2C2C] border-none text-sm text-m3-secondary dark:text-white"
                                            required
                                        />
                                        <input 
                                            type="radio" 
                                            name="correct" 
                                            checked={editingQuiz.correctOption === opt.id}
                                            onChange={() => setEditingQuiz({...editingQuiz, correctOption: opt.id})}
                                            className="w-5 h-5 accent-m3-primary"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-500">Audio (Contexto)</label>
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-[#2C2C2C] border-2 border-dashed border-gray-200 dark:border-white/10 relative">
                                    <div className="p-3 bg-m3-primary/10 rounded-full">
                                        <Upload size={20} className="text-m3-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {newAudioFile ? newAudioFile.name : editingQuiz.audioUrl ? "Ya tiene audio (subir para reemplazar)" : "Sin audio"}
                                        </p>
                                    </div>
                                    <input 
                                        type="file" 
                                        accept="audio/*"
                                        onChange={e => e.target.files?.[0] && setNewAudioFile(e.target.files[0])}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-500">Explicación</label>
                                <textarea 
                                    value={editingQuiz.explanation}
                                    onChange={e => setEditingQuiz({...editingQuiz, explanation: e.target.value})}
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#2C2C2C] border-none focus:ring-2 focus:ring-m3-primary transition-all text-m3-secondary dark:text-white resize-none"
                                    required
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="w-full py-4 rounded-full bg-m3-primary text-white font-bold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                                Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
