import { useState } from 'react';
import { Users, Library, FileEdit, Menu, LogOut, LayoutDashboard, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { auth, storage, db } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ADMIN_UID } from '../constants';

import AdminAgents from './AdminAgents';
import AdminQuizAssigner from './AdminQuizAssigner';
import AdminResults from './AdminResults';

type AdminSection = 'agents' | 'processes' | 'quizzes' | 'assignments' | 'results';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>('agents');
  // ... rest of state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Quiz State
  const [quizSituation, setQuizSituation] = useState('');
  const [quizQuestion, setQuizQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [quizAudio, setQuizAudio] = useState<File | null>(null);

  const handleQuizFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQuizAudio(e.target.files[0]);
    }
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizSituation || !quizQuestion || !optionA || !optionB || !correctOption || !explanation) {
      setError("Por favor completa todos los campos requeridos.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      let audioUrl = '';
      
      // 1. Upload Audio if present
      if (quizAudio) {
        const storageRef = ref(storage, `quizzes/audio/${Date.now()}_${quizAudio.name}`);
        const snapshot = await uploadBytes(storageRef, quizAudio);
        audioUrl = await getDownloadURL(snapshot.ref);
      }

      // 2. Save Quiz to Firestore
      await addDoc(collection(db, 'quizzes'), {
        situation: quizSituation,
        question: quizQuestion,
        audioUrl,
        options: [
            { id: 'A', text: optionA },
            { id: 'B', text: optionB },
            { id: 'C', text: optionC || '' } // Option C optional? Let's keep it consistent
        ].filter(opt => opt.text.trim() !== ''),
        correctOption,
        explanation,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || 'admin',
      });

      setUploadSuccess(true);
      // Reset Form
      setQuizSituation('');
      setQuizQuestion('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setCorrectOption('A');
      setExplanation('');
      setQuizAudio(null);
      
      setTimeout(() => setUploadSuccess(false), 3000);

    } catch (err) {
       console.error("Quiz upload failed:", err);
       setError("Error al crear el quiz.");
    } finally {
      setIsUploading(false);
    }
  };

  const navItems = [
    { id: 'agents', label: 'Gestión de Agentes', icon: Users },
    { id: 'processes', label: 'Biblioteca de Procesos', icon: Library },
    { id: 'quizzes', label: 'Editor de Quizzes', icon: FileEdit },
    { id: 'results', label: 'Resultados', icon: FileEdit }, // Reuse generic icon or CheckCircle
    { id: 'assignments', label: 'Asignador de Quizzes', icon: CheckCircle },
  ];

  return (
    <div className="flex h-screen bg-m3-surface dark:bg-m3-surface-dark transition-colors duration-300 overflow-hidden">
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-m3-surface-variant/30 dark:bg-[#1A1C1E] border-r border-m3-surface-variant/50 dark:border-white/10
        transform transition-transform duration-300 ease-in-out p-4 flex flex-col justify-between
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          <div className="flex items-center gap-3 px-4 mb-8 mt-2">
            <div className="p-2 bg-m3-primary/10 dark:bg-m3-primary-dark/20 rounded-xl">
               <LayoutDashboard className="text-m3-primary dark:text-m3-primary-dark" size={28} />
            </div>
            <h1 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark tracking-tight">
              Supervisor<br/>Workspace
            </h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as AdminSection);
                    setIsMobileMenuOpen(false);
                    setUploadSuccess(false); // Reset states
                    setError(null);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3.5 rounded-[28px] transition-all duration-200 font-medium text-sm tracking-wide
                    ${isActive 
                      ? 'bg-m3-primary text-white shadow-md' 
                      : 'text-m3-secondary dark:text-m3-on-surface-dark/70 hover:bg-m3-surface-variant/50 dark:hover:bg-white/5'
                    }
                  `}
                >
                  <Icon size={20} className={isActive ? 'text-white' : ''} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3.5 rounded-[28px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium text-sm"
        >
            <LogOut size={20} />
            Cerrar Sesión
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-m3-surface-variant/50 dark:border-white/10 bg-m3-surface dark:bg-m3-surface-dark">
            <div className="flex items-center gap-2">
                <LayoutDashboard className="text-m3-primary dark:text-m3-primary-dark" size={24} />
                <span className="font-bold text-m3-secondary dark:text-m3-on-surface-dark">Admin</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2">
                <Menu className="text-m3-secondary dark:text-m3-on-surface-dark" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-2">
                    {navItems.find(i => i.id === activeSection)?.label}
                </h2>
                <p className="text-m3-secondary/70 dark:text-m3-on-surface-dark/60">
                    Administra y configura los recursos del sistema.
                </p>
            </header>

            {/* Content Area */}
            <div className={`bg-white dark:bg-[#1E1E1E] rounded-[28px] min-h-[500px] shadow-sm border border-m3-surface-variant/50 dark:border-white/5 p-8 relative overflow-hidden transition-all duration-300 ${activeSection === 'processes' || activeSection === 'quizzes' ? 'ring-1 ring-m3-primary/10' : ''}`}>
                
                {/* Processes Upload Upload Section */}
                {activeSection === 'processes' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                                <Library className="text-purple-600 dark:text-purple-400" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Subir Nuevo Material</h3>
                                <p className="text-sm text-gray-500">Sube videos o audios para que los agentes los consulten.</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Título del Material
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Protocolo de Empatía 2024"
                                    className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Descripción (Opcional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Breve descripción del contenido..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Archivo (Video o Audio)
                                </label>
                                <div className="border-2 border-dashed border-m3-surface-variant dark:border-white/10 rounded-xl p-8 text-center hover:bg-m3-surface-variant/10 transition-colors cursor-pointer relative group">
                                    <input
                                        type="file"
                                        accept="video/*,audio/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-m3-primary transition-colors">
                                        <Upload size={32} />
                                        <span className="text-sm font-medium">
                                            {file ? file.name : "Haz clic o arrastra un archivo aquí"}
                                        </span>
                                    </div>
                                </div>
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
                                    ¡Material subido exitosamente!
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
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={20} />
                                        Subir Material
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Content Rendering Switch */}
                {activeSection === 'agents' && <AdminAgents />}
                {activeSection === 'assignments' && <AdminQuizAssigner />}
                {activeSection === 'results' && <AdminResults />}

                {/* Quizzes Upload Section */}
                {activeSection === 'quizzes' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                                <FileEdit className="text-emerald-600 dark:text-emerald-400" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Crear Nuevo Quiz</h3>
                                <p className="text-sm text-gray-500">Configura evaluaciones basales en situaciones reales.</p>
                            </div>
                        </div>

                        <form onSubmit={handleQuizSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Situación Crítica
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

                             <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Clip de Audio (Contexto)
                                </label>
                                <div className="border-2 border-dashed border-m3-surface-variant dark:border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-m3-surface-variant/10 transition-colors cursor-pointer relative group">
                                     <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleQuizFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="p-2 bg-m3-primary/10 rounded-full">
                                         <Upload size={20} className="text-m3-primary" />
                                    </div>
                                    <div className="flex-1">
                                         <p className="text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark">
                                            {quizAudio ? quizAudio.name : "Subir clip de llamada"}
                                         </p>
                                         <p className="text-xs text-gray-500">.mp3, .wav (Opcional)</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Pregunta
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

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80">
                                    Opciones de Respuesta
                                </label>
                                {['A', 'B', 'C'].map((opt) => (
                                    <div key={opt} className="flex gap-3 items-center">
                                        <span className="font-bold text-m3-secondary w-6 text-center">{opt}</span>
                                        <input
                                            type="text"
                                            value={opt === 'A' ? optionA : opt === 'B' ? optionB : optionC}
                                            onChange={(e) => {
                                                if (opt === 'A') setOptionA(e.target.value);
                                                if (opt === 'B') setOptionB(e.target.value);
                                                if (opt === 'C') setOptionC(e.target.value);
                                            }}
                                            placeholder={`Opción ${opt}`}
                                            className="flex-1 px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark"
                                            required={opt !== 'C'} // C might be optional
                                        />
                                        <input 
                                            type="radio"
                                            name="correctOption"
                                            checked={correctOption === opt}
                                            onChange={() => setCorrectOption(opt)}
                                            className="w-5 h-5 accent-m3-primary cursor-pointer"
                                            title="Marcar como correcta"
                                        />
                                    </div>
                                ))}
                                <p className="text-xs text-gray-500 text-right pr-2">Selecciona la correcta con el radio button</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                    Explicación (Feedback)
                                </label>
                                <textarea
                                    value={explanation}
                                    onChange={(e) => setExplanation(e.target.value)}
                                    placeholder="Explica por qué esta es la respuesta correcta..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark resize-none"
                                    required
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
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        Guardar Quiz
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}
