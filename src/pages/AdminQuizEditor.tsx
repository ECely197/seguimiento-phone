import { useState, useEffect } from 'react';
import { FileEdit, CheckCircle, AlertCircle, Loader2, Upload, Video, Mic, Building2 } from 'lucide-react';
import { auth, storage, db } from '../firebaseConfig';import { getPublicCollection, getPublicDoc, getAppStorageRef } from '../firebasePaths';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

export default function AdminQuizEditor({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
    // Quiz State
    const [quizSituation, setQuizSituation]   = useState('');
    const [quizQuestion,  setQuizQuestion]    = useState('');
    const [optionA,       setOptionA]         = useState('');
    const [optionB,       setOptionB]         = useState('');
    const [optionC,       setOptionC]         = useState('');
    const [correctOption, setCorrectOption]   = useState('A');
    const [explanation,   setExplanation]     = useState('');
    const [quizMedia, setQuizMedia] = useState<File | null>(null);
    const [lobs, setLobs] = useState<any[]>([]);
    const [selectedLob, setSelectedLob] = useState('');

    useEffect(() => {
        const fetchLobs = async () => {
            try {
                const snap = await getDocs(getPublicCollection('lobs'));
                setLobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) { console.error(err); }
        };
        fetchLobs();
    }, []);

    // Sync with global filter
    useEffect(() => {
        if (globalLobFilter && globalLobFilter !== 'all') {
            setSelectedLob(globalLobFilter);
        }
    }, [globalLobFilter]);

    const [isUploading,   setIsUploading]     = useState(false);
    const [uploadSuccess, setUploadSuccess]   = useState(false);
    const [error,         setError]           = useState<string | null>(null);

    const hasOptions   = optionA.trim() !== '' || optionB.trim() !== '';
    const quizType     = hasOptions ? 'multiple-choice' : 'open-audio';
    const isVideoFile  = quizMedia?.type?.startsWith('video') ?? false;

    const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setQuizMedia(e.target.files[0]);
    };

    const handleQuizSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quizSituation.trim() || !quizQuestion.trim()) {
            setError('Por favor completa la Situación y la Pregunta.');
            return;
        }
        if (hasOptions && (!optionA.trim() || !optionB.trim() || !correctOption)) {
            setError('Para un quiz de opción múltiple, completa al menos las opciones A y B.');
            return;
        }

        setIsUploading(true); setError(null); setUploadSuccess(false);

        try {
            let mediaUrl  = '';
            let mediaType = '';

            if (quizMedia) {
                const ext       = quizMedia.name.split('.').pop();
                const storePath = `quizzes/media/${Date.now()}_${quizMedia.name}`;
                const storageRef = getAppStorageRef(storePath);
                const snapshot = await uploadBytes(storageRef, quizMedia, {
                    contentType: quizMedia.type || `video/${ext}`,
                });
                mediaUrl  = await getDownloadURL(snapshot.ref);
                mediaType = quizMedia.type;
            }

            const options = hasOptions
                ? [
                    { id: 'A', text: optionA },
                    { id: 'B', text: optionB },
                    ...(optionC.trim() ? [{ id: 'C', text: optionC }] : []),
                  ]
                : [];

            await addDoc(getPublicCollection('quizzes'), {
                situation:     quizSituation,
                question:      quizQuestion,
                lobId:         selectedLob,
                mediaUrl,
                mediaType,
                audioUrl:      mediaUrl,
                quizType,
                options,
                correctOption: hasOptions ? correctOption : null,
                explanation,
                createdAt:     serverTimestamp(),
                createdBy:     auth.currentUser?.email || 'admin',
            });

            setUploadSuccess(true);
            setQuizSituation(''); setQuizQuestion(''); setOptionA(''); setOptionB(''); setOptionC('');
            setCorrectOption('A'); setExplanation(''); setQuizMedia(null);
            if (globalLobFilter && globalLobFilter !== 'all') setSelectedLob(globalLobFilter);
            else setSelectedLob('');
            setTimeout(() => setUploadSuccess(false), 3500);
        } catch (err) { setError('Error al crear el quiz.'); } finally { setIsUploading(false); }
    };

    return (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-600">
            {/* Executive Header */}
            <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] border border-m3-surface-variant/30 mb-8 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="p-5 bg-m3-primary/10 rounded-[28px] ring-8 ring-m3-primary/5">
                        <FileEdit className="text-m3-primary" size={36} />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-m3-secondary dark:text-white tracking-tight leading-none">Arquitecto de Quizzes</h3>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-2">Nivel Supervisor · Módulo de Peritaje</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1E1E1E] p-10 rounded-[48px] border border-m3-surface-variant/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                    <div className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
                        quizType === 'open-audio'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'bg-m3-primary/10 text-m3-primary dark:bg-m3-primary/20 dark:text-m3-primary-dark'
                    }`}>
                        {quizType === 'open-audio' ? <Mic size={14} /> : <CheckCircle size={14} />}
                        {quizType === 'open-audio' ? 'Simulacro de Voz' : 'Peritaje de Selección'}
                    </div>
                </div>

                <form onSubmit={handleQuizSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Situación Operativa *</label>
                            <input
                                type="text" value={quizSituation} onChange={(e) => setQuizSituation(e.target.value)}
                                placeholder="Ej. Cliente molesto por demora"
                                className="w-full px-6 py-4 rounded-3xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/5 font-bold text-sm focus:ring-4 focus:ring-m3-primary/10 outline-none transition-all dark:text-white"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Área (LOB) de Despliegue *</label>
                            <div className="relative">
                                <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-m3-primary" size={18} />
                                <select
                                    value={selectedLob} onChange={(e) => setSelectedLob(e.target.value)}
                                    className="w-full pl-14 pr-6 py-4 rounded-3xl bg-indigo-50/50 dark:bg-black/20 border border-indigo-100 dark:border-white/5 font-black text-sm text-m3-secondary dark:text-white outline-none appearance-none cursor-pointer"
                                    required
                                >
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
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Contexto Multimedia (Audio/Video)</label>
                        <div className="border-4 border-dashed border-m3-surface-variant/30 dark:border-white/5 rounded-[40px] p-10 text-center hover:bg-m3-primary/5 transition-all cursor-pointer relative group overflow-hidden">
                            <input type="file" accept="audio/*,video/*" onChange={handleMediaFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="flex flex-col items-center gap-4 text-gray-400 group-hover:text-m3-primary transition-all">
                                <div className="p-4 bg-m3-surface-variant/20 rounded-full group-hover:scale-110 transition-transform">
                                    {isVideoFile ? <Video size={48} /> : <Upload size={48} />}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-widest">
                                        {quizMedia ? quizMedia.name : "Subir Escenario de Audio o Video"}
                                    </p>
                                    <p className="text-[10px] opacity-50 font-bold">Máximo 20MB recomendado</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Pregunta Técnica *</label>
                        <input
                            type="text" value={quizQuestion} onChange={(e) => setQuizQuestion(e.target.value)}
                            placeholder="¿Cuál es la acción correctiva inmediata?"
                            className="w-full px-6 py-4 rounded-3xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/5 font-bold text-sm focus:ring-4 focus:ring-m3-primary/10 outline-none transition-all dark:text-white"
                            required
                        />
                    </div>

                    <div className="bg-gray-50/50 dark:bg-black/20 p-8 rounded-[40px] space-y-4 border border-m3-surface-variant/10">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Matriz de Opciones (Dejar vacío para Roleplay)</label>
                        </div>
                        {(['A', 'B', 'C'] as const).map((opt) => (
                            <div key={opt} className="flex gap-4 items-center group/opt">
                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#2C2C2C] flex items-center justify-center font-black text-m3-primary shadow-sm border border-m3-surface-variant/20">{opt}</div>
                                <input
                                    type="text" value={opt === 'A' ? optionA : opt === 'B' ? optionB : optionC}
                                    onChange={(e) => {
                                        if (opt === 'A') setOptionA(e.target.value);
                                        if (opt === 'B') setOptionB(e.target.value);
                                        if (opt === 'C') setOptionC(e.target.value);
                                    }}
                                    placeholder={`Opción estratégica ${opt}`}
                                    className="flex-1 px-6 py-3.5 rounded-2xl bg-white dark:bg-[#2C2C2C] border border-m3-surface-variant/20 font-bold text-sm outline-none focus:ring-2 focus:ring-m3-primary/50 transition-all dark:text-white shadow-sm"
                                />
                                {hasOptions && (
                                    <input type="radio" name="correctOption" checked={correctOption === opt} onChange={() => setCorrectOption(opt)} className="w-6 h-6 accent-m3-primary cursor-pointer shadow-sm" />
                                )}
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Retroalimentación / Expectativa *</label>
                        <textarea
                            value={explanation} onChange={(e) => setExplanation(e.target.value)}
                            placeholder="Explica la lógica operativa detrás de la respuesta..."
                            rows={3}
                            className="w-full px-6 py-5 rounded-3xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/5 font-bold text-sm focus:ring-4 focus:ring-m3-primary/10 outline-none transition-all dark:text-white resize-none shadow-inner"
                            required
                        />
                    </div>

                    {error && <div className="p-5 bg-rose-50 dark:bg-rose-900/10 text-rose-600 font-bold rounded-2xl text-xs flex items-center gap-3"><AlertCircle size={20} /> {error}</div>}
                    {uploadSuccess && <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 font-bold rounded-2xl text-xs flex items-center gap-3 animate-bounce"><CheckCircle size={20} /> Sincronizado en la Nube</div>}

                    <button
                        type="submit" disabled={isUploading}
                        className={`w-full py-5 rounded-[32px] font-black text-[11px] uppercase tracking-[0.3em] text-white flex items-center justify-center gap-4 transition-all shadow-2xl
                            ${isUploading ? 'bg-gray-400 shadow-none' : 'bg-m3-primary hover:bg-blue-700 hover:scale-[1.01] shadow-m3-primary/30'}
                        `}
                    >
                        {isUploading ? <Loader2 size={24} className="animate-spin" /> : <FileEdit size={24} />}
                        {isUploading ? 'Desplegando...' : 'Publicar Escenario'}
                    </button>
                </form>
            </div>
        </div>
    );
}
