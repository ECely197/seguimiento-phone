import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, AlertCircle, TrendingUp, HelpCircle, Mic, Square, Trash2,
         SendHorizonal, Headphones, Video } from 'lucide-react';
import { auth, storage } from '../firebaseConfig';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebaseConfig';

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuizOption {
  id: string;   // "A", "B", "C"
  text: string;
}

interface QuizModule {
  id: string;
  title: string;        // ← situation
  description: string;  // ← question
  mediaUrl?: string;    // primary (video or audio)
  audioUrl?: string;    // legacy fallback
  mediaType?: string;   // e.g. "video/mp4", "audio/mpeg"
  quizType?: 'multiple-choice' | 'open-audio';
  options?: QuizOption[];
  correctOption?: string;
  explanation?: string;
}

// ── Helper: detect if the media is video ─────────────────────────────────────
const isVideoMedia = (quiz: QuizModule): boolean => {
  if (quiz.mediaType?.startsWith('video')) return true;
  const url = quiz.mediaUrl ?? quiz.audioUrl ?? '';
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
};

const getMediaUrl = (quiz: QuizModule): string =>
  quiz.mediaUrl || quiz.audioUrl || '';

const isOpenAudio = (quiz: QuizModule): boolean =>
  quiz.quizType === 'open-audio' ||
  (!quiz.quizType && (!quiz.options || quiz.options.length === 0));

// ── Main Component ────────────────────────────────────────────────────────────
export default function QuizPage() {
  const [quizzes,         setQuizzes]        = useState<QuizModule[]>([]);
  const [activeQuiz,      setActiveQuiz]     = useState<QuizModule | null>(null);
  const [loading,         setLoading]        = useState(true);

  // Multiple-choice state
  const [completedQuizzes, setCompletedQuizzes] = useState<Set<string>>(new Set());
  const [selectedOption,   setSelectedOption]   = useState<string | null>(null);
  const [isCorrect,        setIsCorrect]         = useState<boolean | null>(null);
  const [showResult,       setShowResult]        = useState(false);
  const [isSubmitting,     setIsSubmitting]      = useState(false);

  // Audio-recorder state
  const [isRecording,      setIsRecording]       = useState(false);
  const [audioBlob,        setAudioBlob]         = useState<Blob | null>(null);
  const [audioPreviewUrl,  setAudioPreviewUrl]   = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  // Stats
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchQuizzes(), fetchUserData()]);
      setLoading(false);
    };
    init();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchQuizzes = async () => {
    const user = auth.currentUser;
    if (!user?.email) return;

    try {
      const assignSnap = await getDocs(
        query(collection(db, 'asignaciones_quizzes'), where('agentEmail', '==', user.email))
      );
      const ids = assignSnap.docs.map(d => d.data().quizId);
      if (ids.length === 0) { setQuizzes([]); return; }

      const details: QuizModule[] = [];
      for (const quizId of ids) {
        const snap = await getDocs(
          query(collection(db, 'quizzes'), where('__name__', '==', quizId))
        );
        if (!snap.empty) {
          const d = snap.docs[0].data();
          details.push({
            id:            snap.docs[0].id,
            title:         d.situation  || 'Contexto del Quiz',
            description:   d.question   || 'Pregunta no disponible',
            mediaUrl:      d.mediaUrl   || d.audioUrl || '',
            audioUrl:      d.audioUrl   || '',
            mediaType:     d.mediaType  || '',
            quizType:      d.quizType   || (d.options?.length ? 'multiple-choice' : 'open-audio'),
            options:       d.options    || [],
            correctOption: d.correctOption,
            explanation:   d.explanation,
          });
        }
      }
      setQuizzes(details);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
    }
  };

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user?.email) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'resultados_quizzes'), where('agentEmail', '==', user.email))
      );
      if (!snap.empty) {

        // Only count MC quizzes in accuracy (open-audio have isCorrect = null)
        const mc      = snap.docs.filter(d => d.data().isCorrect !== null);
        const correct = mc.filter(d => d.data().isCorrect).length;
        setAccuracy(mc.length > 0 ? Math.round((correct / mc.length) * 100) : null);
      } else {
        setAccuracy(null);
      }
      setCompletedQuizzes(new Set(snap.docs.map(d => d.data().quizId)));
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

  // ── Audio recorder ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioPreviewUrl(null);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!activeQuiz || !auth.currentUser?.email) return;
    const openAudio = isOpenAudio(activeQuiz);

    // Guard
    if (!openAudio && !selectedOption) return;
    if (openAudio && !audioBlob) return;

    setIsSubmitting(true);

    try {
      let answerAudioUrl = '';

      // Upload agent audio for open-audio quizzes
      if (openAudio && audioBlob) {
        const path = `answers/${auth.currentUser.uid}/${activeQuiz.id}_${Date.now()}.webm`;
        const snap = await uploadBytes(ref(storage, path), audioBlob, { contentType: 'audio/webm' });
        answerAudioUrl = await getDownloadURL(snap.ref);
      }

      // For MC, also upload optional justification audio if recorded
      let mcAudioUrl = '';
      if (!openAudio && audioBlob) {
        const path = `answers/${auth.currentUser.uid}/${activeQuiz.id}_${Date.now()}.webm`;
        const snap = await uploadBytes(ref(storage, path), audioBlob, { contentType: 'audio/webm' });
        mcAudioUrl = await getDownloadURL(snap.ref);
      }

      const correct = openAudio ? null : selectedOption === activeQuiz.correctOption;

      await addDoc(collection(db, 'resultados_quizzes'), {
        agentEmail:    auth.currentUser.email,
        quizId:        activeQuiz.id,
        quizType:      openAudio ? 'open-audio' : 'multiple-choice',
        selectedOption: openAudio ? null : selectedOption,
        isCorrect:     correct,
        audioUrl:      openAudio ? answerAudioUrl : mcAudioUrl,
        answerAudioUrl: openAudio ? answerAudioUrl : mcAudioUrl,
        timestamp:     serverTimestamp(),
        // Open-audio specific auditing fields
        ...(openAudio && {
          reviewStatus: 'pending',
          tlFeedback:   '',
        })
      });

      setIsCorrect(correct);
      setCompletedQuizzes(prev => new Set(prev).add(activeQuiz.id));
      setShowResult(true);
      await fetchUserData();

    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetQuizState = () => {
    setSelectedOption(null);
    setIsCorrect(null);
    setShowResult(false);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-m3-surface dark:bg-black p-4 pb-24 transition-colors duration-300">
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold text-m3-primary dark:text-m3-primary">Práctica</h1>
        <p className="text-m3-secondary dark:text-gray-400 text-sm">Mejora tus habilidades con casos reales.</p>
      </header>

      {/* Accuracy card — only on list view */}
      {!activeQuiz && !loading && (
        <div className="bg-gradient-to-r from-m3-primary to-blue-600 rounded-[28px] p-6 text-white shadow-lg mb-8 animate-in slide-in-from-top duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold opacity-90 mb-1 flex items-center gap-2">
                <TrendingUp size={20} /> Mi Precisión Histórica
              </h2>
              <p className="text-sm opacity-80">Rendimiento global en quizzes de opción múltiple</p>
            </div>
            <div className="text-4xl font-bold">
              {accuracy !== null ? `${accuracy}%` : <span className="text-2xl opacity-50">--%</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-m3-primary" />
        </div>

      /* ── Active quiz ── */
      ) : activeQuiz ? (() => {
        const openAudio  = isOpenAudio(activeQuiz);
        const mediaUrl   = getMediaUrl(activeQuiz);
        const isVideo    = isVideoMedia(activeQuiz);
        const canSubmit  = openAudio ? (!!audioBlob && !isRecording) : !!selectedOption;

        return (
          <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right duration-500">
            <button
              onClick={() => { setActiveQuiz(null); resetQuizState(); }}
              className="text-m3-primary font-bold text-sm mb-4 hover:underline"
            >
              ← Volver a la lista
            </button>

            {/* Context card */}
            <section className="bg-white dark:bg-[#1E1E1E] rounded-[28px] p-6 shadow-sm border border-m3-surface-variant/50 dark:border-white/10">
              {/* Quiz-type badge */}
              <div className={`mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                openAudio
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {openAudio ? <Mic size={11} /> : <CheckCircle size={11} />}
                {openAudio ? 'Roleplay — Respuesta de Voz' : 'Opción Múltiple'}
              </div>

              <h2 className="text-xl font-bold text-m3-secondary dark:text-white mb-4">{activeQuiz.title}</h2>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-6">
                <p className="font-medium text-blue-900 dark:text-blue-100 text-lg">{activeQuiz.description}</p>
              </div>

              {/* ── Dynamic media player ── */}
              {mediaUrl && (
                isVideo ? (
                  <div className="rounded-2xl overflow-hidden border border-m3-surface-variant/30 dark:border-white/10 mb-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-m3-surface-variant/20 dark:bg-white/5">
                      <Video size={14} className="text-m3-primary" />
                      <span className="text-xs font-semibold text-m3-secondary dark:text-gray-300">Video de Referencia</span>
                    </div>
                    <video
                      src={mediaUrl}
                      controls
                      className="w-full"
                      style={{ maxHeight: 320 }}
                    />
                  </div>
                ) : (
                  <div className="bg-m3-surface-variant/30 dark:bg-white/5 rounded-full px-4 py-3 flex items-center gap-4 mb-2">
                    <div className="bg-m3-primary text-white p-3 rounded-full">
                      <Headphones size={20} />
                    </div>
                    <span className="text-xs text-m3-secondary dark:text-gray-300 font-bold">Audio de Referencia</span>
                    <audio src={mediaUrl} controls className="flex-1 h-9 min-w-0" />
                  </div>
                )
              )}

              {activeQuiz.explanation && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-4">
                  💡 {activeQuiz.explanation}
                </p>
              )}
            </section>

            {/* Answer section */}
            <section className="space-y-6">

              {/* ── Condition A: Multiple-choice ── */}
              {!openAudio && (
                <div>
                  <h3 className="text-lg font-bold text-m3-secondary dark:text-white mb-4">
                    Paso 1: Selecciona la mejor respuesta
                  </h3>
                  <div className="grid gap-3">
                    {activeQuiz.options?.map((option) => {
                      let style = 'bg-white dark:bg-[#2C2C2C] border-2 border-transparent hover:border-m3-primary/30 text-m3-secondary dark:text-gray-200';
                      if (showResult) {
                        if (option.id === activeQuiz.correctOption)
                          style = 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 text-green-800 dark:text-green-300';
                        else if (option.id === selectedOption)
                          style = 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500 text-red-800 dark:text-red-300';
                        else
                          style = 'bg-gray-50 dark:bg-gray-800 opacity-50';
                      } else if (selectedOption === option.id) {
                        style = 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 text-blue-800 dark:text-blue-200';
                      }
                      return (
                        <button
                          key={option.id}
                          onClick={() => !showResult && setSelectedOption(option.id)}
                          disabled={showResult}
                          className={`w-full p-5 rounded-2xl text-left transition-all duration-300 shadow-sm ${style}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              showResult && option.id === activeQuiz.correctOption ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100' :
                              showResult && option.id === selectedOption ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100' :
                              selectedOption === option.id ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100' :
                              'bg-m3-surface-variant dark:bg-white/10 text-m3-secondary dark:text-gray-300'
                            }`}>
                              {option.id}
                            </div>
                            <span className="text-sm font-medium leading-relaxed">{option.text}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Condition B: Open-audio recorder ── */}
              {openAudio && !showResult && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-m3-secondary dark:text-white flex items-center gap-2">
                      <Mic size={20} className="text-purple-500" />
                      Graba tu respuesta *
                    </h3>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full uppercase">
                      Obligatorio
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#2C2C2C] rounded-[24px] p-8 border border-m3-surface-variant/30 dark:border-white/5 flex flex-col items-center gap-5">

                    {!audioPreviewUrl ? (
                      <>
                        <p className="text-sm text-center text-m3-secondary/70 dark:text-gray-400 max-w-xs">
                          Imagina que estás respondiendo al cliente del video. Presiona el micrófono y graba tu respuesta real.
                        </p>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                            isRecording
                              ? 'bg-red-500 animate-pulse ring-4 ring-red-200 dark:ring-red-900/30'
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                        >
                          {isRecording
                            ? <Square size={28} className="text-white" />
                            : <Mic size={28} className="text-white" />}
                        </button>
                        <p className="text-sm font-medium text-m3-secondary dark:text-gray-400">
                          {isRecording ? '🔴 Grabando… (click para detener)' : 'Click para comenzar a grabar'}
                        </p>
                      </>
                    ) : (
                      <div className="w-full space-y-4">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400 text-center">
                          ✅ Audio grabado — escúchalo antes de enviar
                        </p>
                        <div className="flex items-center gap-3">
                          <audio src={audioPreviewUrl} controls className="flex-1 h-10" />
                          <button
                            onClick={deleteRecording}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            title="Descartar y volver a grabar"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Optional justification audio for MC (only if option selected, not submitted) */}
              {!openAudio && selectedOption && !showResult && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-m3-secondary dark:text-white">
                      Paso 2 (Opcional): Justifica tu respuesta
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-white/10 text-xs rounded text-gray-500 dark:text-gray-400">Audio</span>
                  </div>
                  <div className="bg-white dark:bg-[#2C2C2C] rounded-[24px] p-6 border border-m3-surface-variant/30 dark:border-white/5 flex flex-col items-center gap-4">
                    {!audioPreviewUrl ? (
                      <>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                            isRecording
                              ? 'bg-red-500 animate-pulse ring-4 ring-red-200 dark:ring-red-900/30'
                              : 'bg-m3-primary hover:bg-m3-primary/90'
                          }`}
                        >
                          {isRecording ? <Square className="text-white" /> : <Mic className="text-white" />}
                        </button>
                        <p className="text-sm text-m3-secondary dark:text-gray-400">
                          {isRecording ? 'Grabando... (Click para detener)' : 'Graba un audio explicando tu elección'}
                        </p>
                      </>
                    ) : (
                      <div className="w-full flex items-center gap-3">
                        <audio src={audioPreviewUrl} controls className="flex-1 h-10" />
                        <button onClick={deleteRecording} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit button */}
              {!showResult && (
                <button
                  onClick={submitAnswer}
                  disabled={!canSubmit || isSubmitting || isRecording}
                  className="w-full py-4 bg-m3-primary text-white font-bold rounded-[24px] shadow-lg hover:bg-m3-primary/90 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed animate-in fade-in slide-in-from-bottom-4 flex items-center justify-center gap-2"
                >
                  {isSubmitting
                    ? 'Enviando...'
                    : <><SendHorizonal size={18} /> {openAudio ? 'Enviar Respuesta de Voz' : 'Enviar Respuesta'}</>}
                </button>
              )}

              {/* ── Result feedback ── */}
              {showResult && (
                openAudio ? (
                  /* Open-audio: neutral confirmation */
                  <div className="p-6 rounded-[24px] bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 animate-in fade-in slide-in-from-bottom-4 shadow-md">
                    <div className="flex items-start gap-3 mb-3">
                      <Mic className="text-purple-600 dark:text-purple-400 flex-shrink-0" size={24} />
                      <h4 className="font-bold text-lg text-purple-800 dark:text-purple-300">¡Respuesta enviada!</h4>
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-200 mb-6 leading-relaxed">
                      Tu audio fue guardado exitosamente. El supervisor escuchará tu respuesta y te dará retroalimentación personalizada.
                    </p>
                    <button
                      onClick={() => { setActiveQuiz(null); resetQuizState(); }}
                      className="w-full py-3 bg-white dark:bg-white/10 border border-purple-200 dark:border-white/10 text-m3-secondary dark:text-white font-bold rounded-xl shadow-sm hover:bg-purple-50 dark:hover:bg-white/20 transition-colors"
                    >
                      Continuar con otro Quiz
                    </button>
                  </div>
                ) : (
                  /* Multiple-choice: correct / incorrect */
                  <div className={`p-6 rounded-[24px] animate-in fade-in slide-in-from-bottom-4 shadow-md ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect
                        ? <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={24} />
                        : <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={24} />}
                      <h4 className={`font-bold text-lg ${isCorrect ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                        {isCorrect ? '¡Correcto!' : 'Incorrecto'}
                      </h4>
                    </div>
                    <p className={`text-sm leading-relaxed mb-6 ${isCorrect ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}`}>
                      {activeQuiz.explanation || 'No hay explicación disponible.'}
                    </p>
                    <button
                      onClick={() => { setActiveQuiz(null); resetQuizState(); }}
                      className="w-full py-3 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-m3-secondary dark:text-white font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-white/20 transition-colors"
                    >
                      Continuar con otro Quiz
                    </button>
                  </div>
                )
              )}
            </section>
          </div>
        );
      })() : (

        /* ── Quiz list ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {quizzes.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-400">
              <HelpCircle className="mx-auto mb-4 opacity-20" size={48} />
              <p>No hay prácticas disponibles por el momento.</p>
            </div>
          ) : quizzes.map((quiz) => {
            const done      = completedQuizzes.has(quiz.id);
            const roleplay  = isOpenAudio(quiz);
            return (
              <div key={quiz.id} className={`rounded-[28px] p-6 shadow-sm border transition-shadow flex flex-col h-full ${
                done
                  ? 'bg-gray-50 dark:bg-[#121212] border-gray-200 dark:border-white/5 opacity-70'
                  : 'bg-white dark:bg-[#1E1E1E] border-m3-surface-variant/50 dark:border-white/5 hover:shadow-md'
              }`}>
                {/* Type badge */}
                <div className={`mb-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${
                  roleplay
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {roleplay ? <Mic size={9} /> : <CheckCircle size={9} />}
                  {roleplay ? 'Roleplay' : 'Quiz'}
                </div>
                <h3 className="text-lg font-bold text-m3-secondary dark:text-white mb-2 line-clamp-2">{quiz.title}</h3>
                <p className="text-m3-secondary/70 dark:text-gray-400 text-sm mb-6 line-clamp-3 flex-grow">{quiz.description}</p>

                {done ? (
                  <button disabled className="w-full py-3 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold rounded-full cursor-not-allowed flex items-center justify-center gap-2">
                    <CheckCircle size={18} /> Completado
                  </button>
                ) : (
                  <button
                    onClick={() => { setActiveQuiz(quiz); resetQuizState(); }}
                    className="w-full py-3 bg-m3-primary/10 dark:bg-m3-primary/20 text-m3-primary font-bold rounded-full hover:bg-m3-primary/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play size={18} fill="currentColor" />
                    {roleplay ? 'Iniciar Roleplay' : 'Iniciar Quiz'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
