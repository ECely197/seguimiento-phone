import { useState, useEffect } from 'react';
import { Users, Library, FileEdit, Menu, LogOut, LayoutDashboard, Upload, CheckCircle, AlertCircle, Loader2, Pencil, Trash2, Video, Headphones, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, storage, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';

import AdminAgents from './AdminAgents';
import AdminQuizAssigner from './AdminQuizAssigner';
import AdminResults from './AdminResults';
import AdminQuizManager from './AdminQuizManager';
import AdminUsers from './AdminUsers';

type AdminSection = 'agents' | 'processes' | 'quizzes' | 'manage-quizzes' | 'assignments' | 'results' | 'users';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>('agents');
  
  // --- Estados Generales ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();

  // --- Estados para "Explicaciones" (Upload / Edit / List) ---
  const [contentList, setContentList] = useState<any[]>([]); // Lista de contenidos
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // --- Estados para "Crear Quiz" ---
  const [quizSituation, setQuizSituation] = useState('');
  const [quizQuestion, setQuizQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [quizAudio, setQuizAudio] = useState<File | null>(null);

  // ----------------------------------------------------
  // LOGICA: Cargar Contenido (Explicaciones)
  // ----------------------------------------------------
  const fetchContent = async () => {
    try {
      const q = query(collection(db, 'content'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContentList(items);
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  };

  useEffect(() => {
    if (activeSection === 'processes') {
      fetchContent();
    }
  }, [activeSection]);

  // ----------------------------------------------------
  // LOGICA: Cerrar Sesión
  // ----------------------------------------------------
  const handleLogout = async () => {
    try {
        await signOut(auth);
        navigate('/login');
    } catch (err) {
        console.error("Error al cerrar sesión:", err);
    }
  };

  // ----------------------------------------------------
  // LOGICA: Subir Material (Procesos)
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
        setError("Por favor selecciona un archivo y ponle título.");
        return;
    }

    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
        // 1. Subir archivo a Storage
        const storageRef = ref(storage, `content/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        // 2. Guardar referencia en Firestore
        await addDoc(collection(db, 'content'), {
            title,
            description,
            url,
            type: file.type.startsWith('video') ? 'video' : 'audio',
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser?.email || 'admin',
        });

        setUploadSuccess(true);
        setTitle('');
        setDescription('');
        setFile(null);
        fetchContent(); // Recargar lista
        setTimeout(() => setUploadSuccess(false), 3000);

    } catch (err) {
        console.error("Upload error:", err);
        setError("Error al subir el contenido.");
    } finally {
        setIsUploading(false);
    }
  };

  // ----------------------------------------------------
  // LOGICA: Editar y Borrar Material
  // ----------------------------------------------------
  const startEditing = (item: { id: string; title: string; description?: string }) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description || '');
    setFile(null);
    setError(null);
    setUploadSuccess(false);
    // Scroll hacia arriba para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setFile(null);
    setError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !title) {
        setError("El título no puede estar vacío.");
        return;
    }
    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);
    try {
        await updateDoc(doc(db, 'content', editingId), { title, description });
        setUploadSuccess(true);
        cancelEditing();
        fetchContent(); // Recargar lista
        setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
        console.error("Update error:", err);
        setError("Error al actualizar el material.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, url: string) => {
    if(!window.confirm("¿Estás seguro de eliminar este material?")) return;

    try {
      // 1. Eliminar de Firestore
      await deleteDoc(doc(db, 'content', id));
      
      // 2. Intentar eliminar de Storage (Opcional, si falla no rompe la app)
      try {
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn("No se pudo eliminar el archivo de storage (quizás ya no existe)", e);
      }

      fetchContent(); // Recargar lista
    } catch (error) {
      console.error("Error deleting document:", error);
      setError("Error al eliminar el material");
    }
  };

  // ----------------------------------------------------
  // LOGICA: Crear Quiz
  // ----------------------------------------------------
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
      
      if (quizAudio) {
        const storageRef = ref(storage, `quizzes/audio/${Date.now()}_${quizAudio.name}`);
        const snapshot = await uploadBytes(storageRef, quizAudio);
        audioUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'quizzes'), {
        situation: quizSituation,
        question: quizQuestion,
        audioUrl,
        options: [
            { id: 'A', text: optionA },
            { id: 'B', text: optionB },
            { id: 'C', text: optionC || '' } 
        ].filter(opt => opt.text.trim() !== ''),
        correctOption,
        explanation,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || 'admin',
      });

      setUploadSuccess(true);
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
    { id: 'users', label: 'Gestión de Usuarios', icon: Users },
    { id: 'processes', label: 'Explicaciones', icon: Library }, // CAMBIO DE NOMBRE AQUI
    { id: 'quizzes', label: 'Crear Quiz', icon: FileEdit },
    { id: 'manage-quizzes', label: 'Gestionar Quizzes', icon: ListChecks },
    { id: 'assignments', label: 'Asignar Quizzes', icon: CheckCircle },
    { id: 'results', label: 'Resultados', icon: CheckCircle }, 
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
                    setUploadSuccess(false);
                    setError(null);
                    cancelEditing(); // Limpiar edición al cambiar de tab
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

            <div className={`bg-white dark:bg-[#1E1E1E] rounded-[28px] min-h-[500px] shadow-sm border border-m3-surface-variant/50 dark:border-white/5 p-8 relative overflow-hidden transition-all duration-300 ${activeSection === 'processes' || activeSection === 'quizzes' ? 'ring-1 ring-m3-primary/10' : ''}`}>
                
                {/* --- SECCIÓN EXPLICACIONES (PROCESOS) --- */}
                {activeSection === 'processes' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Formulario de Subida / Edición */}
                        <div className="mb-12 p-6 bg-m3-surface-variant/30 dark:bg-white/5 rounded-[20px] border border-m3-surface-variant/50 dark:border-white/10">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                                <Library className="text-purple-600 dark:text-purple-400" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">
                                    {editingId ? 'Editar Material' : 'Subir Nuevo Material'}
                                </h3>
                                <p className="text-sm text-gray-500">Gestiona los videos y audios de explicación.</p>
                            </div>
                          </div>

                          <form onSubmit={editingId ? handleUpdate : handleUpload} className="space-y-6">
                              {editingId && (
                                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-medium">
                                      <Pencil size={16} />
                                      Modo edición — solo se actualizará el título y la descripción.
                                  </div>
                              )}
                              
                              <div className="grid md:grid-cols-2 gap-6">
                                  <div className="space-y-6">
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
                                            placeholder="Breve descripción..."
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark resize-none"
                                        />
                                    </div>
                                  </div>

                                  <div>
                                      {/* File input — oculto si estamos editando */}
                                      {!editingId ? (
                                          <div>
                                              <label className="block text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark/80 mb-2">
                                                  Archivo (Video o Audio)
                                              </label>
                                              <div className="h-[180px] border-2 border-dashed border-m3-surface-variant dark:border-white/10 rounded-xl flex flex-col items-center justify-center text-center hover:bg-m3-surface-variant/10 transition-colors cursor-pointer relative group">
                                                  <input
                                                      type="file"
                                                      accept="video/*,audio/*"
                                                      onChange={handleFileChange}
                                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                  />
                                                  <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-m3-primary transition-colors">
                                                      <Upload size={32} />
                                                      <span className="text-sm font-medium px-4">
                                                          {file ? file.name : "Haz clic o arrastra un archivo aquí"}
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>
                                      ) : (
                                        <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-white/10 p-4 text-center">
                                            <p className="text-sm text-gray-500">
                                                Para cambiar el video, por favor elimina este material y crea uno nuevo.
                                            </p>
                                        </div>
                                      )}
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
                                      ¡Operación exitosa!
                                  </div>
                              )}

                              <div className="flex gap-3">
                                  {editingId && (
                                      <button
                                          type="button"
                                          onClick={cancelEditing}
                                          className="flex-1 py-3 rounded-[28px] font-bold border border-m3-surface-variant dark:border-white/10 text-m3-secondary dark:text-m3-on-surface-dark hover:bg-m3-surface-variant/20 transition-all text-sm"
                                      >
                                          Cancelar
                                      </button>
                                  )}
                                  <button
                                      type="submit"
                                      disabled={isUploading}
                                      className={`flex-1 py-3.5 rounded-[28px] font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg
                                          ${isUploading 
                                              ? 'bg-gray-400 cursor-not-allowed' 
                                              : 'bg-m3-primary hover:bg-blue-700 hover:-translate-y-0.5'
                                          }
                                      `}
                                  >
                                      {isUploading ? (
                                          <>
                                              <Loader2 size={20} className="animate-spin" />
                                              {editingId ? 'Actualizando...' : 'Subiendo...'}
                                          </>
                                      ) : editingId ? (
                                          <>
                                              <Pencil size={20} />
                                              Actualizar Información
                                          </>
                                      ) : (
                                          <>
                                              <Upload size={20} />
                                              Subir Material
                                          </>
                                      )}
                                  </button>
                              </div>
                          </form>
                        </div>

                        {/* LISTA DE CONTENIDO EXISTENTE */}
                        <div>
                            <h4 className="text-lg font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-4 px-1">
                                Biblioteca de Explicaciones ({contentList.length})
                            </h4>
                            
                            <div className="space-y-3">
                                {contentList.length === 0 ? (
                                    <p className="text-gray-500 text-sm italic p-4 text-center bg-gray-50 dark:bg-white/5 rounded-xl">
                                        No hay material subido todavía.
                                    </p>
                                ) : (
                                    contentList.map((item) => (
                                        <div key={item.id} className="group flex items-center justify-between p-4 bg-white dark:bg-[#2C2C2C] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={`p-3 rounded-full shrink-0 ${item.type === 'video' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400'}`}>
                                                    {item.type === 'video' ? <Video size={20} /> : <Headphones size={20} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="font-semibold text-m3-secondary dark:text-m3-on-surface-dark truncate">
                                                        {item.title}
                                                    </h5>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {item.description || "Sin descripción"}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => startEditing(item)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                                                    title="Editar título/descripción"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id, item.url)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                                    title="Eliminar material"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Rendering Switch */}
                {activeSection === 'agents' && <AdminAgents />}
                {activeSection === 'users' && <AdminUsers />}
                {activeSection === 'manage-quizzes' && <AdminQuizManager />}
                {activeSection === 'assignments' && <AdminQuizAssigner />}
                {activeSection === 'results' && <AdminResults />}

                {/* --- SECCIÓN QUIZZES (Solo Creación) --- */}
                {activeSection === 'quizzes' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
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
                                            required={opt !== 'C'} 
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
                                className={`w-full py-4 rounded-[28px] font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg
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