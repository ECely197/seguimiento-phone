import { useState, useEffect } from 'react';
import { Library, Upload, CheckCircle, AlertCircle, Loader2, Trash2, Pencil, Eye, Users } from 'lucide-react';
import { auth, storage, db } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';

export default function AdminProcessUpload() {
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const fetchCategories = async () => {
        try {
            const q = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            setCategories(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
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

    useEffect(() => {
        fetchCategories();
        fetchUsers();
    }, []);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsAddingCategory(true);
        try {
            await addDoc(collection(db, 'categories'), {
                name: newCategoryName.trim(),
                createdAt: serverTimestamp()
            });
            setNewCategoryName('');
            fetchCategories();
        } catch (error) {
            console.error("Error adding category:", error);
            setError("Error al crear la categoría.");
        } finally {
            setIsAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!window.confirm(`¿Seguro que quieres eliminar la categoría "${name}"? Los videos existentes no se borrarán, pero quedarán sin categoría.`)) return;
        try {
            await deleteDoc(doc(db, 'categories', id));
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

        setIsUploading(true);
        setError(null);
        setUploadSuccess(false);

        try {
            // 1. Upload to Storage
            const storageRef = ref(storage, `processes/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 2. Save Metadata to Firestore
            await addDoc(collection(db, 'processes'), {
                title,
                description,
                category,
                url: downloadURL,
                type: file.type.startsWith('video') ? 'video' : 'audio',
                filename: file.name,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.email
            });

            setUploadSuccess(true);
            setTitle('');
            setDescription('');
            setCategory('');
            setFile(null);
            
            setTimeout(() => setUploadSuccess(false), 3000);

        } catch (err) {
            console.error("Upload failed:", err);
            setError("Hubo un error al subir el contenido.");
        } finally {
            setIsUploading(false);
        }
    };

    // New: Fetch existing content
    const [materiales, setMateriales] = useState<any[]>([]);
    
    useEffect(() => {
        const fetchMateriales = async () => {
             try {
                const querySnapshot = await getDocs(collection(db, "processes"));
                const docs = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMateriales(docs);
             } catch (error) {
                 console.error("Error loading materials:", error);
             }
        };
        fetchMateriales();
    }, [uploadSuccess]); // Refresh when upload completes

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este material?")) {
            try {
                await deleteDoc(doc(db, "processes", id));
                setMateriales(prev => prev.filter(item => item.id !== id));
            } catch (error) {
                console.error("Error deleting document:", error);
                alert("Error al eliminar el material.");
            }
        }
    };

    // ---- Edit helpers ----
    const startEditing = (item: any) => {
        setEditingId(item.id);
        setTitle(item.title || item.titulo || '');
        setDescription(item.description || item.descripcion || '');
        setCategory(item.category || '');
        setFile(null);
        setError(null);
        setUploadSuccess(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setCategory('');
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
            await updateDoc(doc(db, 'processes', editingId), { title, description, category });
            setMateriales(prev =>
                prev.map(item =>
                    item.id === editingId ? { ...item, title, description, category } : item
                )
            );
            setUploadSuccess(true);
            cancelEditing();
            setTimeout(() => setUploadSuccess(false), 3000);
        } catch (err) {
            console.error("Update error:", err);
            setError("Error al actualizar el material.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                    <Library className="text-purple-600 dark:text-purple-400" size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Subir Nuevo Material</h3>
                    <p className="text-sm text-gray-500">Sube videos o audios para que los agentes los consulten.</p>
                </div>
                <button 
                    onClick={() => setIsManagingCategories(!isManagingCategories)}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-m3-primary/10 text-m3-primary rounded-full text-xs font-bold hover:bg-m3-primary hover:text-white transition-all shadow-sm"
                >
                    <Library size={16} />
                    {isManagingCategories ? 'Cerrar Gestor' : 'Gestionar Categorías'}
                </button>
            </div>

            {isManagingCategories && (
                <div className="mb-8 p-6 bg-purple-50 dark:bg-purple-900/10 rounded-[24px] border border-purple-100 dark:border-purple-900/20 animate-in slide-in-from-top-2 duration-300">
                    <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-4 flex items-center gap-2">
                        <Library size={18} /> Administrar Categorías
                    </h4>
                    
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            placeholder="Nueva categoría (ej. KPIs)"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1A1C1E] border border-purple-200 dark:border-purple-900/30 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all dark:text-white"
                        />
                        <button 
                            disabled={isAddingCategory || !newCategoryName.trim()}
                            onClick={handleAddCategory}
                            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAddingCategory ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                            Crear
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-black/20 rounded-lg border border-purple-100 dark:border-white/5 group">
                                <span className="text-xs font-medium text-purple-900 dark:text-purple-200 truncate pr-2">{cat.name}</span>
                                <button 
                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                    className="p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {categories.length === 0 && <p className="col-span-full text-center text-xs text-gray-400 py-4 italic">No hay categorías. Crea la primera.</p>}
                    </div>
                </div>
            )}

            <form onSubmit={editingId ? handleUpdate : handleUpload} className="space-y-6">
                {editingId && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-medium">
                        <Pencil size={16} />
                        Modo edición — solo se actualizará el título y la descripción.
                    </div>
                )}
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
                        Categoría
                    </label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-m3-surface dark:bg-[#2C2C2C] border border-m3-surface-variant dark:border-white/10 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary outline-none transition-all text-m3-secondary dark:text-m3-on-surface-dark cursor-pointer"
                        required
                    >
                        <option value="" disabled>Selecciona una categoría</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                        {categories.length === 0 && <option disabled>Crea una categoría primero</option>}
                    </select>
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

                {/* File input — hidden while editing */}
                {!editingId && (
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
                )}

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {uploadSuccess && (
                    <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
                        <CheckCircle size={20} />
                        {editingId ? '¡Material actualizado exitosamente!' : '¡Material subido exitosamente!'}
                    </div>
                )}

                {editingId && (
                    <button
                        type="button"
                        onClick={cancelEditing}
                        className="w-full py-3 rounded-[28px] font-bold border border-m3-surface-variant dark:border-white/10 text-m3-secondary dark:text-m3-on-surface-dark hover:bg-m3-surface-variant/20 transition-all text-sm"
                    >
                        Cancelar Edición
                    </button>
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
            </form>

            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-white/10">
                <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark mb-6">Biblioteca de Contenido Actual</h3>
                
                {materiales.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay material subido aún.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {materiales.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-[#1E1E1E] rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col">
                                <div className="relative w-full aspect-video bg-black">
                                    <video 
                                        src={item.url || item.downloadURL} // Handle both keys just in case
                                        controls 
                                        className="absolute inset-0 w-full h-full object-contain" 
                                    />
                                </div>
                                    <div className="p-5 flex flex-col flex-grow">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark line-clamp-1 text-lg">{item.title || item.titulo}</h4>
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-m3-primary/10 text-m3-primary rounded-full">
                                                {item.category || 'General'}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                                <Eye size={14} className="text-gray-400" />
                                                <span>{item.viewedBy?.length || 0} visualizaciones</span>
                                            </div>
                                            {(item.viewedBy?.length > 0) && (
                                                <button 
                                                    onClick={() => setActiveViewerList(activeViewerList === item.id ? null : item.id)}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-m3-primary dark:text-m3-primary-dark hover:underline uppercase tracking-tight"
                                                >
                                                    <Users size={12} />
                                                    Ver quiénes
                                                </button>
                                            )}
                                        </div>

                                        {activeViewerList === item.id && (
                                            <div className="mb-4 p-3 bg-m3-surface dark:bg-black/30 rounded-xl border border-m3-surface-variant/50 dark:border-white/5 animate-in fade-in zoom-in duration-200">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Visto por:</p>
                                                <div className="max-h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                    {(item.viewedBy || []).map((uid: string) => (
                                                        <div key={uid} className="flex flex-col">
                                                            <span className="text-xs font-semibold text-m3-secondary dark:text-m3-on-surface-dark">
                                                                {allUsers[uid]?.name || 'Usuario desconocido'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">{allUsers[uid]?.email || uid}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{item.description || item.descripcion || "Sin descripción"}</p>
                                        
                                        <div className="flex gap-2 mt-auto">
                                            <button 
                                                onClick={() => startEditing(item)}
                                                className="flex-1 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2 border border-blue-100 dark:border-blue-900/30"
                                            >
                                                <Pencil size={16} />
                                                Editar
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="flex-1 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30"
                                            >
                                                <Trash2 size={16} />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
