import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { appId, db, auth } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { Loader2, Shield, ShieldAlert, CheckCircle, AlertCircle, Search, User, Ban, Lock, Users } from 'lucide-react';
import { ADMIN_UID } from '../constants';

interface UserData {
  id: string;
  email?: string;
  photoURL?: string;
  role?: 'admin' | 'user';
  isAdmin?: boolean; // Legacy
  isBlocked?: boolean;
  createdAt?: any;
  lastLogin?: any;
  [key: string]: any;
}

export default function AdminUsers() {
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
      console.log(`[AdminUsers] Iniciando Doble Fetch de Usuarios (artifacts/${appId} y raíz /users)...`);
      
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

      const usersList = Array.from(userMap.values());
      setUsers(usersList);
      console.log(`[AdminUsers] Total usuarios consolidados: ${usersList.length}`);
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Error al cargar usuarios", 'error');
    } finally {
        setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentRole: 'admin' | 'user' | undefined, currentIsAdmin: boolean | undefined) => {
    // Prevent self-demotion if desired or prevent demoting a specific super-admin
    if (userId === ADMIN_UID) {
        showNotification("No puedes cambiar el rol del Administrador Principal", "error");
        return;
    }

    setProcessingId(userId);
    const isAdmin = currentRole === 'admin' || currentIsAdmin === true;
    const newRole = isAdmin ? 'user' : 'admin';
    
    try {
        const userRef = getUserDoc(userId);
        await updateDoc(userRef, { 
            role: newRole,
            isAdmin: newRole === 'admin' // Keep both for safety during migration
        });
        setUsers(users.map(u => u.id === userId ? {...u, role: newRole, isAdmin: newRole === 'admin'} : u));
        showNotification(newRole === 'admin' ? 'Permisos de admin otorgados' : 'Permisos revocados', 'success');
    } catch (error) {
        console.error("Error:", error);
        showNotification("Error al actualizar permisos", 'error');
    } finally {
        setProcessingId(null);
    }
  };

  const toggleBlockStatus = async (userId: string, currentStatus: boolean | undefined) => {
      // Prevent blocking super admin
      if (userId === ADMIN_UID) {
        showNotification("No puedes bloquear al Administrador Principal", "error");
        return;
      }

      setProcessingId(userId);
      const newStatus = !currentStatus;
      try {
          const userRef = getUserDoc(userId);
          await updateDoc(userRef, { isBlocked: newStatus });
          setUsers(users.map(u => u.id === userId ? {...u, isBlocked: newStatus} : u));
          showNotification(newStatus ? 'Usuario bloqueado' : 'Usuario desbloqueado', 'success');
      } catch (error) {
          console.error("Error:", error);
          showNotification("Error al actualizar estado", 'error');
      } finally {
          setProcessingId(null);
      }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const filteredUsers = users.filter(user => 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp: any) => {
      if (!timestamp) return 'N/A';
      if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
      return new Date(timestamp).toLocaleDateString();
  };

  const isAuthorized = auth.currentUser?.uid === ADMIN_UID || users.find(u => u.id === auth.currentUser?.uid)?.role === 'admin';
  if (!isAuthorized && !loading) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ShieldAlert size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-bold mb-2">Acceso Denegado</h2>
              <p>No tienes permisos para ver esta sección.</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 relative">
        {notification && (
            <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4 ${
                notification.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
            }`}>
                {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span className="font-medium text-sm">{notification.message}</span>
            </div>
        )}

        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark">Gestión de Usuarios</h3>
                <p className="text-sm text-gray-500">Administra accesos y permisos.</p>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar usuario..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2.5 rounded-full border border-m3-surface-variant dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-sm focus:ring-2 focus:ring-m3-primary outline-none min-w-[300px] text-m3-secondary dark:text-white"
                />
            </div>
        </div>

        <div className="flex-1 overflow-auto rounded-[28px] border border-m3-surface-variant/30 dark:border-white/10 bg-white dark:bg-[#1E1E1E] shadow-sm">
            <table className="w-full text-left border-collapse">
                <thead className="bg-m3-surface-variant/40 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider">Usuario</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">Estado</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">Rol</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
                    {loading ? (
                         <tr><td colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-m3-primary" /></td></tr>
                    ) : users.length === 0 ? (
                         <tr>
                            <td colSpan={4} className="p-10 text-center text-gray-400">
                                <Users className="mx-auto mb-2 opacity-20" size={40} />
                                <p>No se encontraron usuarios en artifacts/{appId} ni en raíz.</p>
                            </td>
                         </tr>
                    ) : (
                        filteredUsers.map((user) => {
                            const isAdmin = user.role === 'admin' || user.isAdmin === true;
                            return (
                                <tr key={user.id} className="hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-m3-primary/10 dark:bg-m3-primary/20 flex items-center justify-center text-m3-primary">
                                                        <User size={20} />
                                                    </div>
                                                )}
                                                {user.isBlocked && (
                                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                                                        <Ban size={12} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-medium text-sm ${user.isBlocked ? 'text-gray-400 line-through' : 'text-m3-secondary dark:text-white'}`}>{user.email}</p>
                                                    {user._isLegacy && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-bold uppercase">Legacy</span>}
                                                </div>
                                                <p className="text-xs text-gray-400">{formatDate(user.createdAt || user.lastLogin)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                         <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            user.isBlocked 
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        }`}>
                                            {user.isBlocked ? 'Bloqueado' : 'Activo'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                            isAdmin 
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                                : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                                        }`}>
                                            {isAdmin ? <Shield size={12} fill="currentColor" /> : null}
                                            {isAdmin ? 'Admin' : 'Usuario'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end items-center gap-3">
                                            {/* Block/Unblock Button */}
                                            <button 
                                                onClick={() => toggleBlockStatus(user.id, user.isBlocked)}
                                                disabled={processingId === user.id}
                                                title={user.isBlocked ? "Desbloquear" : "Bloquear"}
                                                className={`p-2 rounded-full transition-colors ${
                                                    user.isBlocked 
                                                        ? 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20' 
                                                        : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20'
                                                }`}
                                            >
                                                {user.isBlocked ? <Lock size={16} className="text-green-600" /> : <Ban size={16} />}
                                            </button>
    
                                            {/* Admin Toggle */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">Admin</span>
                                                <button 
                                                    onClick={() => toggleAdminRole(user.id, user.role, user.isAdmin)}
                                                    disabled={processingId === user.id}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-m3-primary focus:ring-offset-1 ${
                                                        isAdmin ? 'bg-m3-primary' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                            isAdmin ? 'translate-x-5' : 'translate-x-0.5'
                                                        }`}
                                                    />
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
