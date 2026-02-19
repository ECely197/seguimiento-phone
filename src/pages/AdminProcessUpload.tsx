import { useState, useEffect } from 'react';
import { Library, Upload, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { auth, storage, db } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function AdminProcessUpload() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError("Por favor selecciona un archivo.");
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
                url: downloadURL,
                type: file.type.startsWith('video') ? 'video' : 'audio',
                filename: file.name,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.email
            });

            setUploadSuccess(true);
            setTitle('');
            setDescription('');
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
                                    <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark line-clamp-1 text-lg mb-1">{item.title || item.titulo}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2">{item.description || item.descripcion || "Sin descripción"}</p>
                                    
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2 mt-auto border border-red-100 dark:border-red-900/30"
                                    >
                                        <Trash2 size={18} />
                                        Eliminar Material
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
