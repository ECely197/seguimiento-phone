import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Loader2, Shield, ShieldAlert, CheckCircle, XCircle, Search, User, Ban, Lock } from 'lucide-react';
import { ADMIN_UID } from '../constants';

interface UserData {
  id: string;
  email?: string;
  photoURL?: string;
  isAdmin?: boolean;
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
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Error al cargar usuarios", 'error');
    } finally {
        setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentStatus: boolean | undefined) => {
    setProcessingId(userId);
    const newStatus = !currentStatus;
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { isAdmin: newStatus });
        setUsers(users.map(u => u.id === userId ? {...u, isAdmin: newStatus} : u));
        showNotification(newStatus ? 'Permisos de admin otorgados' : 'Permisos revocados', 'success');
    } catch (error) {
        console.error("Error:", error);
        showNotification("Error al actualizar permisos", 'error');
    } finally {
        setProcessingId(null);
    }
  };

  const toggleBlockStatus = async (userId: string, currentStatus: boolean | undefined) => {
      // Prevent blocking admin
      const user = users.find(u => u.id === userId);
      if (user?.isAdmin && !currentStatus) {
         if(!confirm("Estás a punto de bloquear a un administrador. ¿Continuar?")) return;
      }

      setProcessingId(userId);
      const newStatus = !currentStatus;
      try {
          const userRef = doc(db, 'users', userId);
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

  const isAuthorized = auth.currentUser?.uid === ADMIN_UID;
  if (!isAuthorized) {
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
                    ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={4} className="p-10 text-center text-gray-500">No se encontraron usuarios.</td></tr>
                    ) : (
                        filteredUsers.map((user) => (
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
                                            <p className={`font-medium text-sm ${user.isBlocked ? 'text-gray-400 line-through' : 'text-m3-secondary dark:text-white'}`}>{user.email}</p>
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
                                        user.isAdmin 
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                            : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                                    }`}>
                                        {user.isAdmin ? <Shield size={12} fill="currentColor" /> : null}
                                        {user.isAdmin ? 'Admin' : 'Usuario'}
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
                                                onClick={() => toggleAdminRole(user.id, user.isAdmin)}
                                                disabled={processingId === user.id}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-m3-primary focus:ring-offset-1 ${
                                                    user.isAdmin ? 'bg-m3-primary' : 'bg-gray-300 dark:bg-gray-600'
                                                }`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                        user.isAdmin ? 'translate-x-5' : 'translate-x-0.5'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
