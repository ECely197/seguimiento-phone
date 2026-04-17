import { useState, useEffect } from 'react';
import { Library, Upload, CheckCircle, AlertCircle, Loader2, Trash2, Pencil, Eye, Users, Building2 } from 'lucide-react';
import { appId, auth, storage, db } from '../firebaseConfig';import { getPublicCollection, getPublicDoc, getAppStorageRef } from '../firebasePaths';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';

export default function AdminProcessUpload({ selectedLob: globalLobFilter }: { selectedLob?: string }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [category, setCategory] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [isManagingCategories, setIsManagingCategories] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [allUsers, setAllUsers] = useState<Record<string, {name: string, email: string}>>({});
    const [activeViewerList, setActiveViewerList] = useState<string | null>(null);
    const [lobs, setLobs] = useState<any[]>([]);
    const [selectedLob, setSelectedLob] = useState('');

    useEffect(() => {
        if (globalLobFilter && globalLobFilter !== 'all') {
            setSelectedLob(globalLobFilter);
        }
    }, [globalLobFilter]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const fetchCategories = async () => {
        try {
            const q = query(getPublicCollection('categories'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            setCategories(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'users'));
            const userMap: Record<string, {name: string, email: string}> = {};
            querySnapshot.docs.forEach(doc => {
                const data = doc.data();
                userMap[doc.id] = {
                    name: data.displayName || data.name || 'Usuario',
                    email: data.email || ''
                };
            });
            setAllUsers(userMap);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const fetchLobs = async () => {
        try {
            const snap = await getDocs(getPublicCollection('lobs'));
            setLobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchCategories();
        fetchUsers();
        fetchLobs();
    }, []);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsAddingCategory(true);
        try {
            await addDoc(getPublicCollection('categories'), {
                name: newCategoryName.trim(),
                createdAt: serverTimestamp()
            });
            setNewCategoryName('');
            fetchCategories();
        } catch (error) {
            setError("Error al crear la categoría.");
        } finally {
            setIsAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!window.confirm(`¿Seguro que quieres eliminar la categoría "${name}"?`)) return;
        try {
            await deleteDoc(getPublicDoc('categories', id));
            fetchCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !category) {
            setError("Por favor selecciona un archivo y una categoría.");
            return;
        }
        setIsUploading(true); setError(null); setUploadSuccess(false);
        try {
            const storageRef = getAppStorageRef(`processes/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(getPublicCollection('processes'), {
                title,
                description,
                category,
                lobId: selectedLob,
                url: downloadURL,
                type: file.type.startsWith('video') ? 'video' : 'audio',
                filename: file.name,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.email
            });

            setUploadSuccess(true);
            setTitle(''); setDescription(''); setCategory(''); setFile(null);
            if (globalLobFilter && globalLobFilter !== 'all') setSelectedLob(globalLobFilter);
            else setSelectedLob('');
            setTimeout(() => setUploadSuccess(false), 3000);
        } catch (err) {
            setError("Hubo un error al subir el contenido.");
        } finally {
            setIsUploading(false);
        }
    };

    const [materiales, setMateriales] = useState<any[]>([]);
    useEffect(() => {
        const fetchMateriales = async () => {
             try {
                const querySnapshot = await getDocs(getPublicCollection('processes'));
                setMateriales(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
             } catch (error) {
                 console.error("Error loading materials:", error);
             }
        };
        fetchMateriales();
    }, [uploadSuccess]);

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este material?")) {
            try {
                await deleteDoc(getPublicDoc('processes', id));
                setMateriales(prev => prev.filter(item => item.id !== id));
            } catch (error) {
                alert("Error al eliminar el material.");
            }
        }
    };

    const startEditing = (item: any) => {
        setEditingId(item.id);
        setTitle(item.title || item.titulo || '');
        setDescription(item.description || item.descripcion || '');
        setCategory(item.category || '');
        setSelectedLob(item.lobId || '');
        setFile(null); setError(null); setUploadSuccess(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setTitle(''); setDescription(''); setCategory('');
        setSelectedLob(globalLobFilter && globalLobFilter !== 'all' ? globalLobFilter : '');
        setFile(null); setError(null);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId || !title) {
            setError("El título no puede estar vacío.");
            return;
        }
        setIsUploading(true); setError(null);
        try {
            await updateDoc(getPublicDoc('processes', editingId), { title, description, category, lobId: selectedLob });
            setMateriales(prev => prev.map(item => item.id === editingId ? { ...item, title, description, category, lobId: selectedLob } : item));
            setUploadSuccess(true); cancelEditing();
            setTimeout(() => setUploadSuccess(false), 3000);
        } catch (err) { setError("Error al actualizar el material."); } finally { setIsUploading(false); }
    };

    // ── Integrated Filtering ──
    const filteredMaterial = materiales.filter(item => {
        if (globalLobFilter && globalLobFilter !== 'all') {
            return (item.lobId || 'phone') === globalLobFilter;
        }
        return true;
    });

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-white dark:bg-[#1E1E1E] p-6 rounded-[32px] border border-m3-surface-variant/30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-m3-primary/10 rounded-[24px] ring-4 ring-m3-primary/5">
                        <Library className="text-m3-primary" size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-m3-secondary dark:text-white leading-tight">Gestión de Training</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Biblioteca de Procesos Operativos</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsManagingCategories(!isManagingCategories)}
                    className="flex items-center gap-2 px-6 py-3 bg-m3-surface-variant/10 text-m3-secondary dark:text-gray-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-m3-primary hover:text-white transition-all shadow-sm border border-m3-surface-variant/30"
                >
                    <Library size={16} />
                    {isManagingCategories ? 'Cerrar Gestor' : 'Categorías'}
                </button>
            </div>

            {isManagingCategories && (
                <div className="mb-8 p-6 bg-indigo-50/50 dark:bg-m3-primary/5 rounded-[32px] border border-indigo-100 dark:border-m3-primary/20 animate-in slide-in-from-top-4 duration-300">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Library size={16} /> Configuración de Taxonomía
                    </h4>
                    
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" placeholder="Nombre de categoría operativa..."
                            value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-[#1A1C1E] border border-indigo-100 dark:border-white/10 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-300 outline-none transition-all dark:text-white"
                        />
                        <button 
                            disabled={isAddingCategory || !newCategoryName.trim()}
                            onClick={handleAddCategory}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAddingCategory ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                            Crear
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between px-4 py-2 bg-white dark:bg-black/20 rounded-xl border border-indigo-100 dark:border-white/5 group shadow-sm">
                                <span className="text-[10px] font-black text-indigo-900 dark:text-indigo-200 truncate uppercase">{cat.name}</span>
                                <button 
                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] border border-m3-surface-variant/30 shadow-xl mb-12">
                <form onSubmit={editingId ? handleUpdate : handleUpload} className="space-y-6">
                    {editingId && (
                        <div className="flex items-center gap-2 p-4 bg-m3-primary/10 text-m3-primary rounded-2xl text-[10px] font-black uppercase tracking-widest border border-m3-primary/20 animate-pulse">
                            <Pencil size={14} />
                            Edición de Metadatos Activa
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Título del Módulo</label>
                                <input
                                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Guía de Escalación"
                                    className="w-full px-5 py-3.5 rounded-2xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/10 font-bold text-sm focus:ring-2 focus:ring-m3-primary outline-none transition-all dark:text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Área (LOB) Destino</label>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <select
                                        value={selectedLob} onChange={(e) => setSelectedLob(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/10 font-bold text-sm focus:ring-2 focus:ring-m3-primary outline-none transition-all dark:text-white cursor-pointer"
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

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Categoría</label>
                                <select
                                    value={category} onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-5 py-3.5 rounded-2xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/10 font-bold text-sm focus:ring-2 focus:ring-m3-primary outline-none transition-all dark:text-white cursor-pointer"
                                    required
                                >
                                    <option value="" disabled>Seleccionar taxonomía...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Contexto / Guía</label>
                                <textarea
                                    value={description} onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Instrucciones breves para el agente..."
                                    rows={1}
                                    className="w-full px-5 py-3.5 rounded-2xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/10 font-bold text-sm focus:ring-2 focus:ring-m3-primary outline-none transition-all dark:text-white resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {!editingId && (
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Asset Multimedia</label>
                            <div className="border-4 border-dashed border-m3-surface-variant/30 dark:border-white/5 rounded-[32px] p-10 text-center hover:bg-m3-surface-variant/10 transition-all cursor-pointer relative group overflow-hidden">
                                <input type="file" accept="video/*,audio/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="flex flex-col items-center gap-3 text-gray-400 group-hover:text-m3-primary transition-all">
                                    <div className="p-4 bg-m3-surface-variant/20 rounded-full group-hover:scale-110 transition-transform">
                                        <Upload size={40} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest">
                                        {file ? file.name : "Soltar recurso aquí"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 font-bold rounded-2xl text-xs flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
                    {uploadSuccess && <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 font-bold rounded-2xl text-xs flex items-center gap-2 animate-bounce"><CheckCircle size={18} /> Procesado con éxito</div>}

                    <div className="flex gap-3 pt-4">
                        {editingId && (
                            <button type="button" onClick={cancelEditing} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-m3-surface-variant/30 hover:bg-m3-surface-variant/10 transition-all">
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit" disabled={isUploading}
                            className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-3 transition-all shadow-xl
                                ${isUploading ? 'bg-gray-400' : 'bg-m3-primary hover:bg-blue-700 hover:scale-[1.02] shadow-m3-primary/20'}
                            `}
                        >
                            {isUploading ? <Loader2 size={18} className="animate-spin" /> : editingId ? <Pencil size={18} /> : <Upload size={18} />}
                            {isUploading ? 'Sincronizando...' : editingId ? 'Actualizar Biblioteca' : 'Publicar Material'}
                        </button>
                    </div>
                </form>
            </div>

            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-m3-secondary dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <Library className="text-m3-primary" size={20} /> Directorio de Activos
                        {globalLobFilter && globalLobFilter !== 'all' && (
                            <span className="text-[10px] bg-m3-primary/10 text-m3-primary px-3 py-1 rounded-full">{globalLobFilter}</span>
                        )}
                    </h3>
                </div>
                
                {filteredMaterial.length === 0 ? (
                    <div className="p-20 text-center bg-gray-50/50 dark:bg-white/[0.02] rounded-[40px] border-2 border-dashed border-gray-100 dark:border-white/5">
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">Cero materiales en este segmento operativo</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {filteredMaterial.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-[#1E1E1E] rounded-[32px] shadow-sm border border-m3-surface-variant/30 overflow-hidden flex flex-col group hover:shadow-2xl hover:-translate-y-1 transition-all">
                                <div className="relative w-full aspect-video bg-black overflow-hidden">
                                    <video src={item.url} controls className="absolute inset-0 w-full h-full object-contain" />
                                    <div className="absolute top-4 right-4 z-10">
                                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg">
                                            {item.category || 'General'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <h4 className="font-black text-m3-secondary dark:text-white line-clamp-1 text-xl mb-4">{item.title}</h4>
                                    
                                    <div className="flex items-center gap-6 mb-6">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                                            <Eye size={14} className="text-m3-primary/50" />
                                            <span>{item.viewedBy?.length || 0} AUDITORÍAS</span>
                                        </div>
                                        <button 
                                            onClick={() => setActiveViewerList(activeViewerList === item.id ? null : item.id)}
                                            className="text-[9px] font-black text-m3-primary hover:underline uppercase tracking-widest"
                                        >
                                            Ver Historial
                                        </button>
                                    </div>

                                    {activeViewerList === item.id && (
                                        <div className="mb-6 p-4 bg-m3-surface-variant/5 dark:bg-black/30 rounded-2xl border border-m3-surface-variant/20 animate-in zoom-in-95 duration-200">
                                            <div className="max-h-32 overflow-y-auto space-y-3 custom-scrollbar">
                                                {(item.viewedBy || []).map((uid: string) => (
                                                    <div key={uid} className="flex flex-col border-l-2 border-m3-primary pl-3 py-0.5">
                                                        <span className="text-[10px] font-black text-m3-secondary dark:text-white uppercase">{allUsers[uid]?.name || 'Usuario'}</span>
                                                        <span className="text-[9px] text-gray-400 font-medium">{allUsers[uid]?.email || uid}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mb-6">
                                        <Building2 size={12} className="text-gray-400" />
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                            LOB: {item.lobId || 'phone'}
                                        </span>
                                    </div>

                                    <div className="flex gap-2 mt-auto">
                                        <button onClick={() => startEditing(item)} className="flex-1 py-3 bg-m3-surface-variant/10 text-m3-secondary dark:text-gray-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-m3-primary hover:text-white transition-all">
                                            Editar
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
