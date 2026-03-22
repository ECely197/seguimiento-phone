import { useState, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  serverTimestamp, orderBy, query
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Loader2, Plus, Trash2, Pencil, Zap, CheckCircle, X, Upload, Video } from 'lucide-react';

interface AcwScenario {
  id: string;
  title: string;
  videoUrl: string;
  storagePath?: string;
  contextOrderNumber?: string;
  contextTicketId?: string;
}


export default function AdminAcwManager() {
  const [scenarios, setScenarios] = useState<AcwScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const fetchScenarios = async () => {
    try {
      const q = query(getPublicCollection('acw_scenarios'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setScenarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcwScenario)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScenarios(); }, []);

  const handleSave = async () => {
    if (!title.trim()) { setError('El título es obligatorio.'); return; }
    if (!editingId && !videoFile) { setError('Selecciona un archivo de video.'); return; }
    setError('');
    setIsSaving(true);

    try {
      let videoUrl = '';
      let storagePath = '';

      // Upload new video if provided
      if (videoFile) {
        storagePath = `acw_videos/${Date.now()}_${videoFile.name}`;
        const storageRef = getAppStorageRef(storagePath);
        const uploadTask = uploadBytesResumable(storageRef, videoFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => {
              videoUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        contextOrderNumber: orderNumber.trim(),
        contextTicketId: ticketId.trim(),
      };
      if (videoUrl) { payload.videoUrl = videoUrl; payload.storagePath = storagePath; }

      if (editingId) {
        await updateDoc(getPublicDoc('acw_scenarios', editingId), payload);
      } else {
        await addDoc(getPublicCollection('acw_scenarios'), { ...payload, createdAt: serverTimestamp() });
      }

      await fetchScenarios();
      cancelForm();
    } catch (e) {
      console.error(e);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const startEditing = (s: AcwScenario) => {
    setTitle(s.title);
    setOrderNumber(s.contextOrderNumber ?? '');
    setTicketId(s.contextTicketId ?? '');
    setVideoFile(null);
    setEditingId(s.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (s: AcwScenario) => {
    if (!confirm(`¿Eliminar el escenario "${s.title}"?`)) return;
    await deleteDoc(getPublicDoc('acw_scenarios', s.id));
    if (s.storagePath) {
      try { await deleteObject(getAppStorageRef(s.storagePath)); } catch { /* ignore */ }
    }
    setScenarios(prev => prev.filter(x => x.id !== s.id));
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setOrderNumber('');
    setTicketId('');
    setVideoFile(null);
    setError('');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-m3-primary" size={32} /></div>;
  }

  return (
    <div>
      {/* ── Form ── */}
      {showForm && (
        <div className="mb-8 p-6 bg-orange-50 dark:bg-orange-900/10 rounded-3xl border border-orange-100 dark:border-orange-900/20">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <Zap size={18} /> {editingId ? 'Editar Escenario' : 'Nuevo Escenario ACW'}
            </h3>
            <button onClick={cancelForm} className="p-1.5 rounded-full hover:bg-orange-200/50 dark:hover:bg-white/10 transition-colors">
              <X size={18} className="text-orange-600 dark:text-orange-300" />
            </button>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2.5 rounded-xl mb-4">{error}</p>}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-orange-800/70 dark:text-orange-300/70 mb-1.5 uppercase tracking-wide">Título del Escenario *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Local Cerrado"
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1A1E1E] border border-orange-200 dark:border-orange-900/30 text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all dark:text-white" />
            </div>

            {/* Context Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-orange-800/70 dark:text-orange-300/70 mb-1.5 uppercase tracking-wide">Order # (contexto)</label>
                <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Ej: 1909492140"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1A1E1E] border border-orange-200 dark:border-orange-900/30 text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all dark:text-white font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-orange-800/70 dark:text-orange-300/70 mb-1.5 uppercase tracking-wide">Ticket ID (contexto)</label>
                <input type="text" value={ticketId} onChange={e => setTicketId(e.target.value)} placeholder="Ej: 548912300"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1A1E1E] border border-orange-200 dark:border-orange-900/30 text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all dark:text-white font-mono" />
              </div>
            </div>
            <p className="text-xs text-orange-700/60 dark:text-orange-400/60 -mt-1">Estos valores aparecerán en la tarjeta 'Datos del Sistema' que verá el agente durante la práctica.</p>

            {/* Video Upload */}
            <div>
              <label className="block text-xs font-semibold text-orange-800/70 dark:text-orange-300/70 mb-1.5 uppercase tracking-wide">
                Video del Escenario {!editingId && '*'}
                {editingId && <span className="ml-1 text-orange-500/60 normal-case">(dejar vacío para conservar el actual)</span>}
              </label>
              <label className="flex flex-col items-center justify-center gap-3 w-full h-32 border-2 border-dashed border-orange-300 dark:border-orange-800/40 rounded-2xl cursor-pointer bg-orange-50/50 dark:bg-orange-900/5 hover:bg-orange-100/50 dark:hover:bg-orange-900/10 transition-all">
                <input
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={e => setVideoFile(e.target.files?.[0] ?? null)}
                />
                {videoFile
                  ? <><Video size={28} className="text-orange-500" /><span className="text-sm font-medium text-orange-700 dark:text-orange-300 text-center px-4">{videoFile.name}</span></>
                  : <><Upload size={28} className="text-orange-400" /><span className="text-sm text-orange-600/70 dark:text-orange-400/70">Haz clic para seleccionar un video</span></>
                }
              </label>

              {/* Upload Progress */}
              {uploadProgress !== null && (
                <div className="mt-2">
                  <div className="h-2 bg-orange-100 dark:bg-orange-900/20 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all duration-300 rounded-full" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 text-right">{uploadProgress}% subido</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="mt-5 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {editingId ? 'Actualizar' : 'Crear Escenario'}
          </button>
        </div>
      )}

      {/* ── Add Button ── */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setTitle(''); setVideoFile(null); }}
          className="mb-6 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md"
        >
          <Plus size={16} /> Agregar Escenario
        </button>
      )}

      {/* ── List ── */}
      {scenarios.length === 0
        ? <div className="text-center py-16 text-gray-400"><Zap size={40} className="mx-auto mb-3 opacity-30" /><p>Sin escenarios. Crea el primero.</p></div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((s, i) => (
              <div key={s.id} className="bg-m3-surface dark:bg-[#252525] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col">
                <div className="h-36 bg-black relative">
                  <video src={s.videoUrl} className="absolute inset-0 w-full h-full object-contain" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500/90 text-white text-[10px] font-bold rounded-full">#{i + 1}</div>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <h4 className="font-bold text-m3-secondary dark:text-m3-on-surface-dark">{s.title}</h4>
                  <div className="flex gap-3 text-xs text-gray-400 font-mono mb-2">
                    {s.contextOrderNumber && <span>Order: {s.contextOrderNumber}</span>}
                    {s.contextTicketId && <span>Ticket: {s.contextTicketId}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditing(s)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-900/30">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(s)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
