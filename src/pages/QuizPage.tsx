import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, AlertCircle, TrendingUp, HelpCircle, Mic, Square, Trash2 } from 'lucide-react';
import { auth, storage } from '../firebaseConfig';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebaseConfig';

interface QuizOption {
  id: string; // "A", "B", "C"
  text: string;
}

interface QuizModule {
  id: string;
  title: string;       // Mapped from 'situation'
  description: string; // Mapped from 'question'
  audioUrl?: string;
  options?: QuizOption[];
  correctOption?: string;
  explanation?: string;
}

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<QuizModule[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizModule | null>(null);
  const [loading, setLoading] = useState(true);


  // Quiz State
  const [completedQuizzes, setCompletedQuizzes] = useState<Set<string>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Historical Data
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        await Promise.all([fetchQuizzes(), fetchUserData()]);
        setLoading(false);
    };
    init();
  }, []);

  const fetchQuizzes = async () => {
    const user = auth.currentUser;
    if (!user?.email) return;

    try {
      // 1. Fetch assignments for this user
      const assignmentsQuery = query(
        collection(db, "asignaciones_quizzes"), 
        where("agentEmail", "==", user.email)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignedQuizIds = assignmentsSnapshot.docs.map(doc => doc.data().quizId);

      if (assignedQuizIds.length === 0) {
        setQuizzes([]);
        return;
      }

      // 2. Fetch the actual quiz details for these IDs
      // Note: Firestore 'in' operator is limited to 10-30 items depending on version/config
      // For simplicity here, we fetch them and map. If many, we might need a different approach.
      const quizDetails: QuizModule[] = [];
      for (const quizId of assignedQuizIds) {
        const quizSnap = await getDocs(query(collection(db, "quizzes"), where("__name__", "==", quizId)));
        if (!quizSnap.empty) {
            const data = quizSnap.docs[0].data();
            quizDetails.push({
                id: quizSnap.docs[0].id,
                title: data.situation || "Contexto del Quiz",
                description: data.question || "Pregunta no disponible",
                audioUrl: data.audioUrl,
                options: data.options || [],
                correctOption: data.correctOption,
                explanation: data.explanation
            });
        }
      }
      
      setQuizzes(quizDetails);
    } catch (err) {
      console.error("Error fetching assigned quizzes:", err);
    }
  };

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user?.email) return;

    try {
        const q = query(collection(db, 'resultados_quizzes'), where('agentEmail', '==', user.email));
        const snapshot = await getDocs(q);
        
        // 1. Calculate Accuracy
        if (!snapshot.empty) {
            const total = snapshot.size;
            const correct = snapshot.docs.filter(doc => doc.data().isCorrect).length;
            setAccuracy(Math.round((correct / total) * 100));
        } else {
            setAccuracy(null);
        }

        // 2. Identify Completed Quizzes
        const completedIds = new Set(snapshot.docs.map(doc => doc.data().quizId));
        setCompletedQuizzes(completedIds);

    } catch (err) {
        console.error("Error fetching user data:", err);
    }
  };

  // Audio Logic
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
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("No se pudo acceder al micrófono.");
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

  const submitAnswer = async () => {
    if (!selectedOption || !activeQuiz || !auth.currentUser?.email) return;
    
    setIsSubmitting(true);
    const correct = selectedOption === activeQuiz.correctOption;
    setIsCorrect(correct);

    try {
        let uploadedAudioUrl = '';

        // Upload Audio if exists
        if (audioBlob) {
            const filename = `answers/${auth.currentUser.uid}/${activeQuiz.id}_${Date.now()}.webm`;
            const storageRef = ref(storage, filename);
            const snapshot = await uploadBytes(storageRef, audioBlob);
            uploadedAudioUrl = await getDownloadURL(snapshot.ref);
        }

        // Save Result
        await addDoc(collection(db, 'resultados_quizzes'), {
            agentEmail: auth.currentUser.email,
            quizId: activeQuiz.id,
            isCorrect: correct,
            audioUrl: uploadedAudioUrl,
            timestamp: serverTimestamp()
        });

        // Update local state
        setCompletedQuizzes(prev => new Set(prev).add(activeQuiz.id));
        setShowExplanation(true);
        await fetchUserData(); // Refresh accuracy

    } catch (err) {
        console.error("Error submitting answer:", err);
        // setError("Error al guardar la respuesta.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const resetQuizState = () => {
      setSelectedOption(null);
      setIsCorrect(null);
      setShowExplanation(false);
      setAudioBlob(null);
      setAudioPreviewUrl(null);
      // setError(null);
  };

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-black p-4 pb-24 transition-colors duration-300">
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold text-m3-primary dark:text-m3-primary">Práctica</h1>
        <p className="text-m3-secondary dark:text-gray-400 text-sm">Mejora tus habilidades con casos reales.</p>
      </header>

      {/* Historical Accuracy Card */}
      {!activeQuiz && !loading && (
          <div className="bg-gradient-to-r from-m3-primary to-blue-600 rounded-[28px] p-6 text-white shadow-lg mb-8 animate-in slide-in-from-top duration-500">
              <div className="flex items-center justify-between">
                  <div>
                      <h2 className="text-lg font-bold opacity-90 mb-1 flex items-center gap-2">
                          <TrendingUp size={20} /> Mi Precisión Histórica
                      </h2>
                      <p className="text-sm opacity-80">Rendimiento global en quizzes</p>
                  </div>
                  <div className="text-4xl font-bold">
                      {accuracy !== null ? `${accuracy}%` : <span className="text-2xl opacity-50">--%</span>}
                  </div>
              </div>
          </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-m3-primary"></div>
        </div>
      ) : activeQuiz ? (
          <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right duration-500">
             <button 
                onClick={() => {
                    setActiveQuiz(null);
                    resetQuizState();
                }}
                className="text-m3-primary font-bold text-sm mb-4 hover:underline"
             >
                ← Volver a la lista
             </button>

            {/* Context Card */}
            <section className="bg-white dark:bg-[#1E1E1E] rounded-[28px] p-6 shadow-sm border border-m3-surface-variant/50 dark:border-white/10">
              <h2 className="text-xl font-bold text-m3-secondary dark:text-white mb-2">{activeQuiz.title}</h2>
              <p className="text-m3-secondary/80 dark:text-gray-300 mb-6 text-sm">
                 Contexto: {activeQuiz.title}
              </p>

               <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-6">
                    <p className="font-medium text-blue-900 dark:text-blue-100 text-lg">
                        {activeQuiz.description}
                    </p>
               </div>
              
              {activeQuiz.audioUrl && (
                  <div className="bg-m3-surface-variant/30 dark:bg-white/5 rounded-full p-4 flex items-center gap-4 mb-4">
                     <div className="bg-m3-primary text-white p-3 rounded-full">
                        <Play size={24} fill="currentColor" />
                     </div>
                     <span className="text-xs text-m3-secondary dark:text-gray-300 font-bold">Audio de Referencia</span>
                     <audio src={activeQuiz.audioUrl} controls className="opacity-50 w-32" />
                  </div>
              )}
            </section>
    
            {/* Answer Section */}
            <section className="space-y-6">
                {/* Step 1: Multiple Choice */}
                <div>
                     <h3 className="text-lg font-bold text-m3-secondary dark:text-white mb-4">
                        Paso 1: Selecciona la mejor respuesta
                     </h3>
                    <div className="grid gap-3">
                        {activeQuiz.options?.map((option) => {
                            let buttonStyle = "bg-white dark:bg-[#2C2C2C] border-2 border-transparent hover:border-m3-primary/30 dark:hover:border-m3-primary/50 text-m3-secondary dark:text-gray-200";
                            if (showExplanation) { // Result Mode
                                if (option.id === activeQuiz.correctOption) {
                                    buttonStyle = "bg-green-100 dark:bg-green-900/30 border-2 border-green-500 text-green-800 dark:text-green-300";
                                } else if (option.id === selectedOption && option.id !== activeQuiz.correctOption) {
                                    buttonStyle = "bg-red-100 dark:bg-red-900/30 border-2 border-red-500 text-red-800 dark:text-red-300";
                                } else {
                                    buttonStyle = "bg-gray-50 dark:bg-gray-800 opacity-50";
                                }
                            } else if (selectedOption === option.id) { // Selection Mode
                                buttonStyle = "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 text-blue-800 dark:text-blue-200";
                            }

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => !showExplanation && setSelectedOption(option.id)}
                                    disabled={showExplanation}
                                    className={`w-full p-5 rounded-2xl text-left transition-all duration-300 shadow-sm ${buttonStyle}`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                            showExplanation && option.id === activeQuiz.correctOption ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                            showExplanation && option.id === selectedOption ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100' : 
                                            selectedOption === option.id ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100' : 'bg-m3-surface-variant dark:bg-white/10 text-m3-secondary dark:text-gray-300'
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

                {/* Step 2: Optional Audio (Only if option selected and not submitted yet) */}
                {selectedOption && !showExplanation && (
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
                                    <button 
                                        onClick={deleteRecording}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {selectedOption && !showExplanation && (
                    <button 
                        onClick={submitAnswer}
                        disabled={isSubmitting || isRecording}
                        className="w-full py-4 bg-m3-primary text-white font-bold rounded-[24px] shadow-lg hover:bg-m3-primary/90 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed animate-in fade-in slide-in-from-bottom-4"
                    >
                        {isSubmitting ? 'Enviando...' : 'Enviar Respuesta'}
                    </button>
                )}

                {/* Feedback Section */}
                {showExplanation && (
                    <div className={`p-6 rounded-[24px] animate-in fade-in slide-in-from-bottom-4 shadow-md ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <div className="flex items-start gap-3 mb-3">
                            {isCorrect ? (
                                <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={24} />
                            ) : (
                                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={24} />
                            )}
                            <h4 className={`font-bold text-lg ${isCorrect ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                                {isCorrect ? '¡Correcto!' : 'Incorrecto'}
                            </h4>
                        </div>
                        <p className={`text-sm leading-relaxed mb-6 ${isCorrect ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}`}>
                            {activeQuiz.explanation || "No hay explicación disponible."}
                        </p>
                        
                        <button 
                            onClick={() => {
                                setActiveQuiz(null);
                                resetQuizState();
                            }}
                            className="w-full py-3 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-m3-secondary dark:text-white font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-white/20 transition-colors"
                        >
                            Continuar con otro Quiz
                        </button>
                    </div>
                )}
            </section>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
           {quizzes.length === 0 ? (
               <div className="col-span-full text-center py-20 text-gray-400">
                   <HelpCircle className="mx-auto mb-4 opacity-20" size={48} />
                   <p>No hay prácticas disponibles por el momento.</p>
               </div>
           ) : (
               quizzes.map((quiz) => {
                   const isCompleted = completedQuizzes.has(quiz.id);
                   return (
                       <div key={quiz.id} className={`rounded-[28px] p-6 shadow-sm border transition-shadow flex flex-col h-full ${
                           isCompleted 
                           ? 'bg-gray-50 dark:bg-[#121212] border-gray-200 dark:border-white/5 opacity-70' 
                           : 'bg-white dark:bg-[#1E1E1E] border-m3-surface-variant/50 dark:border-white/5 hover:shadow-md'
                       }`}>
                           <h3 className="text-lg font-bold text-m3-secondary dark:text-white mb-2 line-clamp-2">{quiz.title}</h3>
                           <p className="text-m3-secondary/70 dark:text-gray-400 text-sm mb-6 line-clamp-3 flex-grow">{quiz.description}</p>
                           
                           {isCompleted ? (
                               <button 
                                 disabled
                                 className="w-full py-3 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold rounded-full cursor-not-allowed flex items-center justify-center gap-2"
                               >
                                   <CheckCircle size={18} />
                                   Completado
                               </button>
                           ) : (
                               <button 
                                 onClick={() => {
                                     setActiveQuiz(quiz);
                                     resetQuizState();
                                 }}
                                 className="w-full py-3 bg-m3-primary/10 dark:bg-m3-primary/20 text-m3-primary dark:text-m3-primary font-bold rounded-full hover:bg-m3-primary/20 dark:hover:bg-m3-primary/30 transition-colors flex items-center justify-center gap-2"
                               >
                                   <Play size={18} fill="currentColor" />
                                   Iniciar Quiz
                               </button>
                           )}
                       </div>
                   );
               })
           )}
        </div>
      )}
    </div>
  );
}
