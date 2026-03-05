import { useState } from 'react';
import { FileEdit, CheckCircle, AlertCircle, Loader2, Upload, Video, Mic } from 'lucide-react';
import { auth, storage, db } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminQuizEditor() {
    // Quiz State
    const [quizSituation, setQuizSituation]   = useState('');
    const [quizQuestion,  setQuizQuestion]    = useState('');
    const [optionA,       setOptionA]         = useState('');
    const [optionB,       setOptionB]         = useState('');
    const [optionC,       setOptionC]         = useState('');
    const [correctOption, setCorrectOption]   = useState('A');
    const [explanation,   setExplanation]     = useState('');
    const [quizMedia,     setQuizMedia]       = useState<File | null>(null);

    const [isUploading,   setIsUploading]     = useState(false);
    const [uploadSuccess, setUploadSuccess]   = useState(false);
    const [error,         setError]           = useState<string | null>(null);

    // ── Derived: is this an open-audio quiz? ──────────────────────────────────
    const hasOptions   = optionA.trim() !== '' || optionB.trim() !== '';
    const quizType     = hasOptions ? 'multiple-choice' : 'open-audio';
    const isVideoFile  = quizMedia?.type?.startsWith('video') ?? false;

    const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setQuizMedia(e.target.files[0]);
    };

    const handleQuizSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Required: situation + question
        if (!quizSituation.trim() || !quizQuestion.trim()) {
            setError('Por favor completa la Situación y la Pregunta.');
            return;
        }
        // If multiple-choice, must have at least A + B + correct
        if (hasOptions && (!optionA.trim() || !optionB.trim() || !correctOption)) {
            setError('Para un quiz de opción múltiple, completa al menos las opciones A y B.');
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadSuccess(false);

        try {
            let mediaUrl  = '';
            let mediaType = '';

            // 1. Upload media file if present
            if (quizMedia) {
                const ext       = quizMedia.name.split('.').pop();
                const storePath = `quizzes/media/${Date.now()}_${quizMedia.name}`;
                const storageRef = ref(storage, storePath);
                // Pass contentType so browsers can stream video natively
                const snapshot = await uploadBytes(storageRef, quizMedia, {
                    contentType: quizMedia.type || `video/${ext}`,
                });
                mediaUrl  = await getDownloadURL(snapshot.ref);
                mediaType = quizMedia.type;
            }

            // 2. Build options array (empty for open-audio)
            const options = hasOptions
                ? [
                    { id: 'A', text: optionA },
                    { id: 'B', text: optionB },
                    ...(optionC.trim() ? [{ id: 'C', text: optionC }] : []),
                  ]
                : [];

            // 3. Save to Firestore
            await addDoc(collection(db, 'quizzes'), {
                situation:     quizSituation,
                question:      quizQuestion,
                mediaUrl,
                mediaType,
                // Backwards-compat field for old QuizPage code
                audioUrl:      mediaUrl,
                quizType,
                options,
                correctOption: hasOptions ? correctOption : null,
                explanation,
                createdAt:     serverTimestamp(),
                createdBy:     auth.currentUser?.email || 'admin',
            });

            setUploadSuccess(true);
            // Reset
            setQuizSituation('');
            setQuizQuestion('');
            setOptionA(''); setOptionB(''); setOptionC('');
            setCorrectOption('A');
            setExplanation('');
            setQuizMedia(null);
            setTimeout(() => setUploadSuccess(false), 3500);

        } catch (err) {
            console.error('Quiz upload failed:', err);
            setError('Error al crear el quiz. Inténtalo de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                    <FileEdit className="text-emerald-600 dark:text-emerald-400" size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Crear Nuevo Quiz</h3>
                    <p className="text-sm text-gray-500">Configura evaluaciones o simulaciones de roleplay.</p>
                </div>
            </div>

            {/* Quiz-type badge */}
            <div className={`mb-6 flex items-center gap-2 px-4 py-2 rounded-full w-fit text-xs font-bold uppercase tracking-wider ${
                quizType === 'open-audio'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
                {quizType === 'open-audio' ? <Mic size={13} /> : <CheckCircle size={13} />}
                {quizType === 'open-audio' ? 'Modo Roleplay (respuesta abierta)' : 'Modo Opción Múltiple'}
            </div>

            <form onSubmit={handleQuizSubmit} className="space-y-6">
                {/* Situation */}
                <div>
                    <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                        Situación Crítica *
                    </label>
                    <input
                        type="text"
                        value={quizSituation}
                        onChange={(e) => setQuizSituation(e.target.value)}
                        placeholder="Ej. Partner molesto por pedido incompleto"
                        className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark"
                        required
                    />
                </div>

                {/* Media upload */}
                <div>
                    <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                        Clip de Audio o Video (Contexto)
                    </label>
                    <div className="border-2 border-dashed border-m3-surface-variant dark:border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-m3-surface-variant/10 transition-colors cursor-pointer relative group">
                        <input
                            type="file"
                            accept="audio/*,video/mp4,video/webm,video/ogg,video/quicktime"
                            onChange={handleMediaFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="p-2 bg-m3-primary/10 rounded-full">
                            {isVideoFile ? <Video size={20} className="text-m3-primary" /> : <Upload size={20} className="text-m3-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark truncate">
                                {quizMedia ? quizMedia.name : 'Subir clip de llamada o video'}
                            </p>
                            <p className="text-xs text-gray-500">.mp3 · .wav · .mp4 · .webm (Opcional)</p>
                        </div>
                        {quizMedia && (
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                isVideoFile
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                                {isVideoFile ? 'Video' : 'Audio'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Question */}
                <div>
                    <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                        Pregunta *
                    </label>
                    <input
                        type="text"
                        value={quizQuestion}
                        onChange={(e) => setQuizQuestion(e.target.value)}
                        placeholder="¿Cuál es la mejor respuesta empática?"
                        className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark"
                        required
                    />
                </div>

                {/* Options — optional */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80">
                            Opciones de Respuesta
                            <span className="ml-2 text-xs font-normal text-gray-400">(Opcional — dejar vacío para Roleplay)</span>
                        </label>
                    </div>
                    {(['A', 'B', 'C'] as const).map((opt) => (
                        <div key={opt} className="flex gap-3 items-center">
                            <span className="font-bold text-m3-secondary dark:text-m3-on-surface-dark w-6 text-center">{opt}</span>
                            <input
                                type="text"
                                value={opt === 'A' ? optionA : opt === 'B' ? optionB : optionC}
                                onChange={(e) => {
                                    if (opt === 'A') setOptionA(e.target.value);
                                    if (opt === 'B') setOptionB(e.target.value);
                                    if (opt === 'C') setOptionC(e.target.value);
                                }}
                                placeholder={`Opción ${opt}${opt === 'C' ? ' (opcional)' : ''}`}
                                className="flex-1 px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark"
                            />
                            {/* Only show radio if options exist */}
                            {hasOptions && (
                                <input
                                    type="radio"
                                    name="correctOption"
                                    checked={correctOption === opt}
                                    onChange={() => setCorrectOption(opt)}
                                    className="w-5 h-5 accent-m3-primary cursor-pointer"
                                    title="Marcar como correcta"
                                />
                            )}
                        </div>
                    ))}
                    <p className="text-xs text-gray-500 text-right pr-2">
                        {hasOptions ? 'Selecciona la correcta con el radio button' : 'Modo Roleplay activo — el agente grabará su respuesta de voz'}
                    </p>
                </div>

                {/* Explanation */}
                <div>
                    <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                        Explicación / Instrucciones{quizType === 'open-audio' ? ' (Qué esperas del agente)' : ' (Feedback)'}
                    </label>
                    <textarea
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        placeholder={quizType === 'open-audio'
                            ? 'Ej. Graba cómo responderías a este cliente molesto de forma empática...'
                            : 'Explica por qué esta es la respuesta correcta...'}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark resize-none"
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {uploadSuccess && (
                    <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
                        <CheckCircle size={20} />
                        ¡Quiz creado exitosamente!
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isUploading}
                    className={`w-full py-3.5 rounded-[28px] font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg
                        ${isUploading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-m3-primary hover:bg-blue-700 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isUploading ? (
                        <><Loader2 size={20} className="animate-spin" /> Guardando...</>
                    ) : (
                        <><CheckCircle size={20} /> Guardar Quiz</>
                    )}
                </button>
            </form>
        </div>
    );
}
