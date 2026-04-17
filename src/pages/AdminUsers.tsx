import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { appId, db, auth } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { Loader2, Shield, ShieldAlert, CheckCircle, AlertCircle, Search, User, Ban, Lock, Users, Building2 } from 'lucide-react';
import { ADMIN_UID } from '../constants';

interface UserData {
  id: string;
  email?: string;
  photoURL?: string;
  role?: 'admin' | 'user';
  isAdmin?: boolean; 
  isBlocked?: boolean;
  lob?: string;
  createdAt?: any;
  lastLogin?: any;
  [key: string]: any;
}

export default function AdminUsers({ selectedLob }: { selectedLob?: string }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const pathNew = collection(db, 'artifacts', appId, 'users');
      const pathOld = collection(db, 'users');

      const [resNew, resOld] = await Promise.allSettled([
        getDocs(pathNew),
        getDocs(pathOld)
      ]);

      const userMap = new Map<string, UserData>();
      if (resNew.status === 'fulfilled') {
        resNew.value.docs.forEach(doc => {
          userMap.set(doc.id, { id: doc.id, ...doc.data() } as UserData);
        });
      }
      if (resOld.status === 'fulfilled') {
        resOld.value.docs.forEach(doc => {
          if (!userMap.has(doc.id)) {
            userMap.set(doc.id, { id: doc.id, ...doc.data(), _isLegacy: true } as UserData);
          }
        });
      }

      setUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Error al cargar usuarios", 'error');
    } finally {
        setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentRole: 'admin' | 'user' | undefined, currentIsAdmin: boolean | undefined) => {
    if (userId === ADMIN_UID) {
        showNotification("No puedes cambiar el rol del Administrador Principal", "error");
        return;
    }
    setProcessingId(userId);
    const isAdmin = currentRole === 'admin' || currentIsAdmin === true;
    const newRole = isAdmin ? 'user' : 'admin';
    try {
        await updateDoc(getUserDoc(userId), { role: newRole, isAdmin: newRole === 'admin' });
        setUsers(users.map(u => u.id === userId ? {...u, role: newRole, isAdmin: newRole === 'admin'} : u));
        showNotification(newRole === 'admin' ? 'Permisos de admin otorgados' : 'Permisos revocados', 'success');
    } catch (error) {
        showNotification("Error al actualizar permisos", 'error');
    } finally {
        setProcessingId(null);
    }
  };

  const toggleBlockStatus = async (userId: string, currentStatus: boolean | undefined) => {
      if (userId === ADMIN_UID) {
        showNotification("No puedes bloquear al Administrador Principal", "error");
        return;
      }
      setProcessingId(userId);
      const newStatus = !currentStatus;
      try {
          await updateDoc(getUserDoc(userId), { isBlocked: newStatus });
          setUsers(users.map(u => u.id === userId ? {...u, isBlocked: newStatus} : u));
          showNotification(newStatus ? 'Usuario bloqueado' : 'Usuario desbloqueado', 'success');
      } catch (error) {
          showNotification("Error al actualizar estado", 'error');
      } finally {
          setProcessingId(null);
      }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const filteredUsers = users.filter(user => {
      const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      
      if (selectedLob && selectedLob !== 'all') {
          return user.lob === selectedLob;
      }
      return true;
  });

  const formatDate = (timestamp: any) => {
      if (!timestamp) return 'N/A';
      if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
      return new Date(timestamp).toLocaleDateString();
  };

  const isAuthorized = auth.currentUser?.uid === ADMIN_UID || users.find(u => u.id === auth.currentUser?.uid)?.role === 'admin';
  if (!isAuthorized && !loading) {
      return (
          <div className="flex flex-col items-center justify-center p-20 text-center">
              <ShieldAlert size={64} className="text-red-500 mb-6 drop-shadow-lg" />
              <h2 className="text-2xl font-black text-m3-secondary dark:text-white mb-2 uppercase tracking-tight">Acceso Restringido</h2>
              <p className="text-gray-500 text-sm max-w-xs">Solo personal autorizado de nivel Supervisor puede gestionar los accesos del sistema.</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 relative">
        {notification && (
            <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 ${
                notification.type === 'success' ? 'bg-m3-primary text-white' : 'bg-red-600 text-white'
            }`}>
                {notification.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                <span className="font-bold text-sm tracking-wide">{notification.message}</span>
            </div>
        )}

        <div className="flex justify-between items-center mb-8 bg-m3-surface-variant/5 dark:bg-white/[0.02] p-4 rounded-[28px] border border-m3-surface-variant/20">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" placeholder="Filtrar por correo electrónico..." 
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-m3-surface-variant dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none transition-all"
                />
            </div>
            {selectedLob && selectedLob !== 'all' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-m3-primary/10 rounded-xl border border-m3-primary/20">
                    <Building2 size={16} className="text-m3-primary" />
                    <span className="text-[10px] font-black text-m3-primary uppercase tracking-widest">Filtrado por: {selectedLob}</span>
                </div>
            )}
        </div>

        <div className="flex-1 overflow-auto rounded-[32px] border border-m3-surface-variant/30 dark:border-white/10 bg-white dark:bg-[#1E1E1E] shadow-sm">
            <table className="w-full text-left border-collapse">
                <thead className="bg-m3-surface-variant/20 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-m3-secondary/60 dark:text-m3-on-surface-dark/50 uppercase tracking-widest italic">Identidad de Usuario</th>
                        <th className="px-6 py-4 text-[10px] font-black text-m3-secondary/60 dark:text-m3-on-surface-dark/50 uppercase tracking-widest text-center">Estado de Red</th>
                        <th className="px-6 py-4 text-[10px] font-black text-m3-secondary/60 dark:text-m3-on-surface-dark/50 uppercase tracking-widest text-center">Rango Operativo</th>
                        <th className="px-6 py-4 text-[10px] font-black text-m3-secondary/60 dark:text-m3-on-surface-dark/50 uppercase tracking-widest text-right">Protección</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-m3-surface-variant/10 dark:divide-white/5">
                    {loading ? (
                         <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-m3-primary" size={40} /></td></tr>
                    ) : filteredUsers.length === 0 ? (
                         <tr>
                            <td colSpan={4} className="p-20 text-center text-gray-400">
                                <Users className="mx-auto mb-4 opacity-20" size={48} />
                                <p className="font-bold uppercase text-[10px] tracking-widest">Cero coincidencias en el segmento actual</p>
                            </td>
                         </tr>
                    ) : (
                        filteredUsers.map((user) => {
                            const isAdmin = user.role === 'admin' || user.isAdmin === true;
                            return (
                                <tr key={user.id} className="hover:bg-m3-primary/5 dark:hover:bg-white/5 transition-all group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-2xl object-cover shadow-sm group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-2xl bg-m3-primary/10 dark:bg-m3-primary-dark/20 flex items-center justify-center text-m3-primary group-hover:scale-110 transition-transform">
                                                    <User size={20} />
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-bold text-xs ${user.isBlocked ? 'text-gray-400 line-through' : 'text-m3-secondary dark:text-white'}`}>{user.email}</p>
                                                    {user._isLegacy && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 rounded-full font-black uppercase tracking-tighter">Legacy</span>}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-gray-500 font-bold">{formatDate(user.createdAt || user.lastLogin)}</p>
                                                    {user.lob && <span className="w-1 h-1 rounded-full bg-gray-300" />}
                                                    {user.lob && <span className="text-[10px] text-m3-primary font-black uppercase tracking-widest">{user.lob}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                                            user.isBlocked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                            {user.isBlocked ? 'Bloqueado' : 'Operativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                                                isAdmin ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {isAdmin ? '🛡️ Supervisor' : 'Agente'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-4">
                                            <button 
                                                onClick={() => toggleBlockStatus(user.id, user.isBlocked)}
                                                disabled={processingId === user.id}
                                                className={`p-2.5 rounded-xl transition-all ${
                                                    user.isBlocked ? 'bg-green-50 text-green-600 hover:scale-110' : 'bg-red-50 text-red-500 hover:scale-110'
                                                }`}
                                            >
                                                {user.isBlocked ? <Lock size={18} /> : <Ban size={18} />}
                                            </button>
                                            <div className="h-8 w-px bg-m3-surface-variant/30 mx-1" />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-gray-400">Admin</span>
                                                <button 
                                                    onClick={() => toggleAdminRole(user.id, user.role, user.isAdmin)}
                                                    disabled={processingId === user.id}
                                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all ${
                                                        isAdmin ? 'bg-indigo-600 shadow-md' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-all ${isAdmin ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
