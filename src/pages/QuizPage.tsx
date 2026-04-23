import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, AlertCircle, TrendingUp, HelpCircle, Mic, Square, Trash2,
         SendHorizonal, Headphones, Video } from 'lucide-react';
import { auth, storage } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { collection, setDoc, getDocs, addDoc, query, where, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, appId } from '../firebaseConfig';

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
  lobId?: string;
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
  const [userLob,         setUserLob]         = useState<string | null>(null);

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
    const fetchUserLob = async () => {
      const user = auth.currentUser;
      if (!user) {
        setUserLob('phone');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid));
        setUserLob(snap.exists() ? (snap.data().lob || 'phone') : 'phone');
      } catch (err) {
        console.error(err);
        setUserLob('phone');
      }
    };
    fetchUserLob();
  }, []);

  useEffect(() => {
    if (!userLob) return;
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchQuizzes(), fetchUserData()]);
      setLoading(false);
    };
    init();
  }, [userLob]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchQuizzes = async () => {
    try {
      const { getDocsWithFallback, getPublicCollection: gpc } = await import("../firebasePaths");
      const { fquery, fwhere, fgetDocs, fcol } = {
        fquery: query,
        fwhere: where,
        fgetDocs: getDocs,
        fcol: collection
      };

      const user = auth.currentUser;
      let details: QuizModule[] = [];

      console.log(`[QuizPage] Iniciando búsqueda de Quizzes para LOB: ${userLob} (${user ? 'Modo Agente' : 'Modo Invitado'})...`);

      if (!user) {
        // Modo Invitado: Cargar quizzes del LOB 'phone' (públicos)
        const snap = await getDocsWithFallback("quizzes");
        details = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(d => (d.lobId === 'phone' || !d.lobId))
          .map(data => ({
            id: data.id,
            title: data.situation || 'Contexto del Quiz',
            description: data.question || 'Pregunta no disponible',
            mediaUrl: data.mediaUrl || data.audioUrl || '',
            audioUrl: data.audioUrl || '',
            mediaType: data.mediaType || '',
            quizType: data.quizType || (data.options?.length ? 'multiple-choice' : 'open-audio'),
            options: data.options || [],
            correctOption: data.correctOption,
            explanation: data.explanation,
            lobId: data.lobId || 'phone'
          }));
      } else {
        // Usuario autenticado: Buscar asignaciones
        const pathAsignNew = gpc('asignaciones_quizzes');
        const pathAsignOld = fcol(db, 'asignaciones_quizzes');

        const [snapAsignNew, snapAsignOld] = await Promise.allSettled([
          fgetDocs(fquery(pathAsignNew, fwhere('agentEmail', '==', user.email))),
          fgetDocs(fquery(pathAsignOld, fwhere('agentEmail', '==', user.email)))
        ]);

        const assignedIds = new Set();
        if (snapAsignNew.status === 'fulfilled') snapAsignNew.value.docs.forEach(d => assignedIds.add(d.data().quizId));
        if (snapAsignOld.status === 'fulfilled') snapAsignOld.value.docs.forEach(d => assignedIds.add(d.data().quizId));

        // Cargar TODOS los quizzes y filtrar por IDs asignados Y que pertenezcan al LOB (o phone)
        const snapQuizzes = await getDocsWithFallback("quizzes");
        
        details = snapQuizzes.docs
          .filter(d => assignedIds.has(d.id))
          .map(d => ({ id: d.id, ...d.data() } as any))
          // We show assigned quizzes regardless of current LOB if they were explicitly assigned,
          // OR we can be strict and filter by userLob too. Let's do a "User LOB + Phone" filter for assignments too or just trust assignments.
          // Usually, an assignment overrides the general LOB filter. but let's stick to the assigned area.
          .map(data => ({
            id: data.id,
            title: data.situation || 'Contexto del Quiz',
            description: data.question || 'Pregunta no disponible',
            mediaUrl: data.mediaUrl || data.audioUrl || '',
            audioUrl: data.audioUrl || '',
            mediaType: data.mediaType || '',
            quizType: data.quizType || (data.options?.length ? 'multiple-choice' : 'open-audio'),
            options: data.options || [],
            correctOption: data.correctOption,
            explanation: data.explanation,
            lobId: data.lobId || 'phone'
          }));
      }
      
      setQuizzes(details);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
    }
  };

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) {
      // Modo Invitado: Recuperar progreso de localStorage
      const guestProgress = JSON.parse(localStorage.getItem('guest_completed_quizzes') || '[]');
      setCompletedQuizzes(new Set(guestProgress));
      setAccuracy(null);
      return;
    }

    if (!user.email) return;
    try {
      const snap = await getDocs(
        query(getUserCollection(user.uid, 'resultados_quizzes'))
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
    if (!activeQuiz) return;
    const openAudio = isOpenAudio(activeQuiz);

    // Guard
    if (!openAudio && !selectedOption) return;
    if (openAudio && !audioBlob) return;

    setIsSubmitting(true);

    try {
      const isGuest = !auth.currentUser;
      const uidTemp = isGuest ? ("guest_" + crypto.randomUUID().slice(0, 8)) : auth.currentUser!.uid;
      const agentEmail = isGuest ? "invitado@visitante.com" : auth.currentUser!.email;

      let answerAudioUrl = '';

      // Upload agent audio for open-audio quizzes
      if (openAudio && audioBlob) {
        const path = `answers/${uidTemp}/${activeQuiz.id}_${Date.now()}.webm`;
        const snap = await uploadBytes(getAppStorageRef(path), audioBlob, { contentType: 'audio/webm' });
        answerAudioUrl = await getDownloadURL(snap.ref);
      }

      // For MC, also upload optional justification audio if recorded
      let mcAudioUrl = '';
      if (!openAudio && audioBlob) {
        const path = `answers/${uidTemp}/${activeQuiz.id}_${Date.now()}.webm`;
        const snap = await uploadBytes(getAppStorageRef(path), audioBlob, { contentType: 'audio/webm' });
        mcAudioUrl = await getDownloadURL(snap.ref);
      }

      const correct = openAudio ? null : selectedOption === activeQuiz.correctOption;

      await setDoc(getUserDoc(uidTemp), {
        isGuest: isGuest,
        email: agentEmail,
        name: isGuest ? "Invitado" : (auth.currentUser?.displayName || ""),
        lastActivity: serverTimestamp(),
        lob: userLob
      }, { merge: true });
      await addDoc(getUserCollection(uidTemp, 'resultados_quizzes'), {
        agentEmail:    agentEmail,
        isGuest:       isGuest,
        userName:      isGuest ? "Invitado" : (auth.currentUser?.displayName || ""),
        userId:        uidTemp,
        quizId:        activeQuiz.id,
        quizType:      openAudio ? 'open-audio' : 'multiple-choice',
        selectedOption: openAudio ? null : selectedOption,
        isCorrect:     correct,
        audioUrl:      openAudio ? answerAudioUrl : mcAudioUrl,
        answerAudioUrl: openAudio ? answerAudioUrl : mcAudioUrl,
        timestamp:     serverTimestamp(),
        lobId:         userLob,
        // Open-audio specific auditing fields
        ...(openAudio && {
          reviewStatus: 'pending',
          tlFeedback:   '',
        })
      });

      setIsCorrect(correct);
      setCompletedQuizzes(prev => {
        const next = new Set(prev).add(activeQuiz.id);
        if (isGuest) {
          localStorage.setItem('guest_completed_quizzes', JSON.stringify(Array.from(next)));
        }
        return next;
      });
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
    <div className="min-h-screen bg-[#050505] p-4 md:p-8 relative pb-40">
      
      {/* ── Hero / Stats ── */}
      {!activeQuiz && (
        <div className="bg-gradient-to-br from-blue-900/40 to-[#0A0A0A] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between shadow-[0_0_40px_rgba(59,130,246,0.15)] mb-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300 flex items-center justify-center md:justify-start gap-3">
              <TrendingUp className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" size={32} />
              Precisión Histórica
            </h2>
          </div>
          <div className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mt-4 md:mt-0 relative z-10">
            {accuracy !== null ? `${accuracy}%` : <span className="text-4xl opacity-50">--%</span>}
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
          <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right duration-500 relative z-10">
            <button
              onClick={() => { setActiveQuiz(null); resetQuizState(); }}
              className="text-gray-400 font-bold text-sm mb-4 hover:text-white transition-colors"
            >
              ← Volver a Operaciones
            </button>

            {/* Context card */}
            <section className="bg-[#0A0A0A]/80 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl border border-white/5 relative group">
              {/* Quiz-type badge */}
              <div className={`mb-6 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full ${
                openAudio
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {openAudio ? <Mic size={12} /> : <CheckCircle size={12} />}
                {openAudio ? 'ROLEPLAY CINEMÁTICO' : 'EVALUACIÓN MÚLTIPLE'}
              </div>

              <h2 className="text-2xl font-black text-white mb-6 drop-shadow-md">{activeQuiz.title}</h2>

              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8 backdrop-blur-md">
                <p className="font-semibold text-gray-200 text-lg leading-relaxed">{activeQuiz.description}</p>
              </div>

              {/* ── Dynamic media player ── */}
              {mediaUrl && (
                isVideo ? (
                  <div className="rounded-3xl border border-white/10 shadow-2xl bg-white/5 p-2 mb-4">
                    <div className="flex items-center gap-2 px-4 py-3">
                      <Video size={16} className="text-blue-400 shadow-blue-500" />
                      <span className="text-[11px] font-black tracking-widest text-gray-300 uppercase">Referencia Multimedia</span>
                    </div>
                    <video
                      src={mediaUrl}
                      controls
                      className="w-full rounded-2xl object-cover bg-black"
                      style={{ maxHeight: 400 }}
                    />
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-3xl p-4 flex items-center gap-6 mb-4 border border-white/10">
                    <div className="bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)] text-white p-4 rounded-full shrink-0">
                      <Headphones size={24} />
                    </div>
                    <div className="flex-1 w-full flex flex-col gap-2">
                       <span className="text-[11px] font-black tracking-widest text-gray-300 uppercase">Audio de Evidencia</span>
                       <audio src={mediaUrl} controls className="w-full h-10" />
                    </div>
                  </div>
                )
              )}

              {activeQuiz.explanation && (
                <p className="text-sm text-gray-400 italic mt-6 border-l-2 border-indigo-500/50 pl-4 bg-indigo-900/10 py-2">
                  💡 {activeQuiz.explanation}
                </p>
              )}
            </section>

            {/* Answer section */}
            <section className="space-y-6">

              {/* ── Condition A: Multiple-choice ── */}
              {!openAudio && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-6 drop-shadow-sm">
                    Misión: Selecciona la resolución óptima
                  </h3>
                  <div className="grid gap-4">
                    {activeQuiz.options?.map((option) => {
                      let style = 'bg-[#111] border border-white/5 hover:border-blue-500/50 hover:bg-white/5 text-gray-300';
                      if (showResult) {
                        if (option.id === activeQuiz.correctOption)
                          style = 'bg-green-900/40 border-2 border-green-500 text-green-200 shadow-[0_0_20px_rgba(34,197,94,0.2)]';
                        else if (option.id === selectedOption)
                          style = 'bg-red-900/40 border-2 border-red-500 text-red-200';
                        else
                          style = 'bg-[#0A0A0A]/50 opacity-50 border-transparent text-gray-500';
                      } else if (selectedOption === option.id) {
                        style = 'bg-blue-600/20 border-2 border-blue-500 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.3)] transform scale-[1.01]';
                      }
                      return (
                        <button
                          key={option.id}
                          onClick={() => !showResult && setSelectedOption(option.id)}
                          disabled={showResult}
                          className={`w-full p-6 mx-auto max-w-full rounded-3xl text-left transition-all duration-300 ${style}`}
                        >
                          <div className="flex items-center gap-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 shadow-lg ${
                              showResult && option.id === activeQuiz.correctOption ? 'bg-green-500 text-white' :
                              showResult && option.id === selectedOption ? 'bg-red-500 text-white' :
                              selectedOption === option.id ? 'bg-blue-600 text-white shadow-[0_0_15px_currentColor]' :
                              'bg-white/10 text-white border border-white/20'
                            }`}>
                              {option.id}
                            </div>
                            <span className="text-base font-semibold leading-relaxed">{option.text}</span>
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
                  <div className="flex items-center justify-between mb-6 border-t border-white/10 pt-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      <Mic size={24} className="text-purple-500" />
                      Captura tu intervención
                    </h3>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black rounded-full uppercase tracking-widest drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                      Evidencia Requerida
                    </span>
                  </div>

                  <div className="bg-[#111] backdrop-blur-md rounded-3xl p-12 border border-white/10 flex flex-col items-center gap-6 shadow-[inset_0_2px_40px_rgba(0,0,0,0.5)]">

                    {!audioPreviewUrl ? (
                      <>
                        <p className="text-sm text-center text-gray-400 max-w-sm mb-4 font-medium">
                          Dirígete al micrófono como si estuvieras en línea con el cliente. Sé firme, preciso y respeta el protocolo operativo.
                        </p>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`rounded-full flex items-center justify-center transition-all mx-auto shadow-2xl ${
                            isRecording
                              ? 'w-28 h-28 bg-red-500 shadow-[0_0_80px_rgba(239,68,68,0.6)] animate-pulse border-none text-white'
                              : 'w-24 h-24 bg-[#111] border border-white/10 hover:bg-white/10 text-white active:scale-95'
                          }`}
                        >
                          {isRecording
                            ? <Square size={36} fill="currentColor" />
                            : <Mic size={36} fill="currentColor" className="opacity-80" />}
                        </button>
                        <div className="flex flex-col items-center mt-2">
                           <p className={`text-sm font-bold tracking-widest uppercase transition-colors ${isRecording ? 'text-red-500' : 'text-gray-500'}`}>
                             {isRecording ? '🔴 Grabación Activa' : 'Presiona para grabar'}
                           </p>
                           {isRecording && <span className="text-[10px] text-red-500/70 font-mono mt-1 font-bold">Haz clic para finalizar captura</span>}
                        </div>
                      </>
                    ) : (
                      <div className="w-full space-y-4">
                        <p className="text-sm font-bold text-green-400 text-center uppercase tracking-widest">
                          ✅ Audio grabado — Confirmación visual
                        </p>
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full p-2 pr-4 shadow-lg text-white">
                          <audio src={audioPreviewUrl} controls className="flex-1 h-10" />
                          <button
                            onClick={deleteRecording}
                            className="p-2 text-red-500 hover:bg-red-900/20 rounded-full transition-colors flex items-center justify-center"
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
                    <h3 className="text-lg font-bold text-white">
                      Paso 2 (Opcional): Justifica tu respuesta
                    </h3>
                    <span className="px-2 py-1 bg-white/10 text-xs rounded text-gray-400">Audio</span>
                  </div>
                  <div className="bg-[#111] rounded-[24px] p-6 border border-white/5 flex flex-col items-center gap-4">
                    {!audioPreviewUrl ? (
                      <>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                            isRecording
                              ? 'bg-red-500 animate-pulse ring-4 ring-red-900/30'
                              : 'bg-white/10 border border-white/20 hover:bg-white/20'
                          }`}
                        >
                          {isRecording ? <Square className="text-white" /> : <Mic className="text-white opacity-80" />}
                        </button>
                        <p className="text-sm text-gray-400">
                          {isRecording ? 'Grabando... (Click para detener)' : 'Graba un audio explicando tu elección'}
                        </p>
                      </>
                    ) : (
                      <div className="w-full flex items-center gap-3 text-white">
                        <audio src={audioPreviewUrl} controls className="flex-1 h-10" />
                        <button onClick={deleteRecording} className="p-2 text-red-500 hover:bg-red-900/20 rounded-full transition-colors">
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
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-widest text-sm rounded-[24px] shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed animate-in fade-in slide-in-from-bottom-4 flex items-center justify-center gap-3 border border-blue-500/50"
                >
                  {isSubmitting
                    ? 'Procesando...'
                    : <><SendHorizonal size={20} /> {openAudio ? 'Enviar Respuesta Cinematica' : 'Confimar Resolución'}</>}
                </button>
              )}

              {/* ── Result feedback ── */}
              {showResult && (
                openAudio ? (
                  /* Open-audio: neutral confirmation */
                  <div className="p-6 rounded-[24px] bg-purple-900/20 border border-purple-800/30 animate-in fade-in slide-in-from-bottom-4 shadow-lg text-purple-200">
                    <div className="flex items-start gap-3 mb-3">
                      <Mic className="text-purple-400 flex-shrink-0" size={24} />
                      <h4 className="font-bold text-lg text-purple-300">Misión Completada Exitosamente</h4>
                    </div>
                    <p className="text-sm mb-6 leading-relaxed opacity-80 font-medium">
                      Tu evidencia fue almacenada. Tu supervisor analizará tu desempeño y calidad de atención y te otorgará feedback directamente.
                    </p>
                    <button
                      onClick={() => { setActiveQuiz(null); resetQuizState(); }}
                      className="w-full py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl shadow-sm hover:bg-white/20 transition-colors"
                    >
                      Tomar Siguiente Misión
                    </button>
                  </div>
                ) : (
                  /* Multiple-choice: correct / incorrect */
                  <div className={`p-6 rounded-[24px] animate-in fade-in slide-in-from-bottom-4 shadow-lg border ${isCorrect ? 'bg-green-900/20 border-green-800/30 text-green-200' : 'bg-red-900/20 border-red-800/30 text-red-200'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect
                        ? <CheckCircle className="text-green-400 flex-shrink-0" size={24} />
                        : <AlertCircle className="text-red-400 flex-shrink-0" size={24} />}
                      <h4 className={`font-black text-lg ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {isCorrect ? '¡Resolución Optima!' : 'Análisis Incorrecto'}
                      </h4>
                    </div>
                    <p className={`text-sm leading-relaxed mb-6 font-medium`}>
                      {activeQuiz.explanation || 'Protocolo completado y procesado.'}
                    </p>
                    <button
                      onClick={() => { setActiveQuiz(null); resetQuizState(); }}
                      className="w-full py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl shadow-sm hover:bg-white/20 transition-colors"
                    >
                      Continuar a Nueva Misión
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
            <div className="col-span-full text-center py-20 text-gray-500">
              <HelpCircle className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-lg font-medium mb-2 text-gray-400">No hay misiones disponibles para el área {userLob?.toUpperCase()}.</p>
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-left shadow-sm">
                <p className="text-blue-500 mb-1 font-bold">Status de Rescate de Misiones:</p>
                <p className="text-gray-400">• LOB asignado: {userLob} ... OK</p>
                <p className="text-gray-400">• Se requiere asignación directa del TL/Supervisor.</p>
              </div>
            </div>
          ) : quizzes.map((quiz) => {
            const done      = completedQuizzes.has(quiz.id);
            const roleplay  = isOpenAudio(quiz);
            return (
              <div key={quiz.id} className={`bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 transition-all duration-500 relative overflow-hidden flex flex-col h-full group text-gray-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
                done
                  ? 'opacity-60 grayscale-[0.5]'
                  : 'hover:-translate-y-4 hover:border-blue-500/50 hover:shadow-[0_20px_80px_-20px_rgba(59,130,246,0.4)]'
              }`}>
                {/* Aura Neon interna */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                {/* Type badge premium */}
                <div className={`mb-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full w-max relative z-10 ${
                  roleplay
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                }`}>
                  {roleplay ? <Mic size={12} className={!done ? "animate-pulse" : ""} /> : <CheckCircle size={12} />}
                  {roleplay ? 'Misión: Roleplay Pro' : 'Misión: Lógica Crítica'}
                </div>

                <h3 className="text-2xl font-black text-white mb-3 line-clamp-2 leading-tight relative z-10 drop-shadow-md group-hover:text-blue-400 transition-colors">{quiz.title}</h3>
                <p className="text-gray-400 text-sm mb-8 line-clamp-3 flex-grow relative z-10 font-medium leading-relaxed">{quiz.description}</p>

                <div className="mt-auto relative z-10 w-full pt-6 border-t border-white/5">
                {done ? (
                  <div className="w-full py-4 bg-green-500/5 text-green-500 border border-green-500/20 font-black text-center rounded-2xl flex items-center justify-center gap-2 tracking-widest text-[11px] uppercase">
                    <CheckCircle size={16} /> Completada con éxito
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveQuiz(quiz); resetQuizState(); }}
                    className="w-full py-4 px-6 bg-white/5 hover:bg-blue-600 text-white font-black rounded-2xl transition-all duration-500 flex items-center justify-center gap-3 active:scale-95 shadow-xl border border-white/10 group-hover:border-blue-400/50 uppercase tracking-widest text-xs"
                  >
                    <Play size={18} fill="currentColor" />
                    {roleplay ? 'Iniciar Desafío' : 'Resolver Misión'}
                  </button>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
