import { useState, useEffect } from 'react';
import { Users, Library, FileEdit, Menu, LogOut, LayoutDashboard, CheckCircle, ListChecks, Zap, Eye, Clock, Shield, Building2, Globe, BarChart3, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db, appId } from '../firebaseConfig';
import { getPublicCollection } from '../firebasePaths';
import { getDocs } from 'firebase/firestore';

import AdminAgents from './AdminAgents';
import AdminQuizAssigner from './AdminQuizAssigner';
import AdminProcessUpload from './AdminProcessUpload';
import AdminQuizEditor from './AdminQuizEditor';
import AdminUsers from './AdminUsers';
import AdminQuizManager from './AdminQuizManager';
import AdminAcwManager from './AdminAcwManager';
import AdminAcwStats from './AdminAcwStats';
import AdminIdleReport from './AdminIdleReport';
import AdminLobPermissions from './AdminLobPermissions';
import AdminLobManager from './AdminLobManager';
import AdminHistoryReport from './AdminHistoryReport';

type AdminSection = 'agents' | 'processes' | 'quizzes' | 'manage-quizzes' | 'assignments' | 'users' | 'acw' | 'acw-stats' | 'idle-report' | 'permissions' | 'lob-manager' | 'glob-stats' | 'daily-history';

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('agents');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedLob, setSelectedLob] = useState<string>('all');
  const [lobs, setLobs] = useState<{id: string, name: string}[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLobs = async () => {
      try {
        const snap = await getDocs(getPublicCollection('lobs'));
        const list = snap.docs.map(d => ({ id: d.id, name: d.data().name || d.id }));
        setLobs(list);
      } catch (e) {
        console.error("Error fetching lobs for filter:", e);
      }
    };
    fetchLobs();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { id: 'agents', label: 'Directorio de Agentes', icon: Users },
    { id: 'users', label: 'Gestión de Accesos', icon: Shield },
    { id: 'processes', label: 'Carga de Contenido', icon: Library },
    { id: 'quizzes', label: 'Crear Quiz', icon: FileEdit },
    { id: 'manage-quizzes', label: 'Gestionar Quizzes', icon: ListChecks },
    { id: 'assignments', label: 'Asignar Quizzes', icon: CheckCircle },
    { id: 'acw', label: 'Simulador ACW', icon: Zap },
    { id: 'acw-stats', label: 'Métricas ACW', icon: BarChart3 },
    { id: 'idle-report', label: 'Reporte Disponibilidad', icon: Clock },
    { id: 'daily-history', label: 'Histórico Operativo', icon: BarChart3 },
    { id: 'lob-manager', label: 'Gestión de Áreas (LOB)', icon: Building2 },
    { id: 'glob-stats', label: 'Consolidado Global', icon: Globe },
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center gap-3 px-4 mb-6 mt-2">
            <div className="p-2 bg-m3-primary/10 dark:bg-m3-primary-dark/20 rounded-xl">
               <LayoutDashboard className="text-m3-primary dark:text-m3-primary-dark" size={28} />
            </div>
            <h1 className="text-xl font-bold text-m3-secondary dark:text-m3-on-surface-dark tracking-tight leading-tight">
              Supervisor<br/>Admin Panel
            </h1>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as AdminSection);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-medium text-sm tracking-wide
                    ${isActive 
                      ? 'bg-m3-primary text-white shadow-md' 
                      : 'text-m3-secondary dark:text-m3-on-surface-dark/70 hover:bg-m3-surface-variant/50 dark:hover:bg-white/5'
                    }
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-white' : ''} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-m3-surface-variant/30">
          <div className="px-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Administrador</p>
            <p className="text-xs font-semibold text-m3-secondary dark:text-m3-on-surface-dark truncate">
              {auth.currentUser?.email}
            </p>
          </div>

          <button
            onClick={() => navigate('/home')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-m3-surface-variant/50 dark:bg-white/5 border border-m3-surface-variant/50 dark:border-white/10 text-m3-secondary dark:text-m3-on-surface-dark/80 hover:bg-m3-primary/10 dark:hover:bg-m3-primary-dark/10 hover:text-m3-primary hover:border-m3-primary transition-all font-bold text-xs"
          >
            <Eye size={16} />
            Ir a Vista de Agente
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-bold text-xs"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Top bar with filter */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-m3-surface-dark/80 backdrop-blur-md border-b border-m3-surface-variant/50 dark:border-white/10 p-4 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2">
                <Menu size={20} className="text-m3-secondary dark:text-m3-on-surface-dark" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-m3-secondary dark:text-m3-on-surface-dark">
                  {navItems.find(i => i.id === activeSection)?.label}
              </h2>
              <p className="text-[10px] font-bold text-m3-primary uppercase tracking-widest">Edwin Admin Panel · Phase 2</p>
            </div>
          </div>

          {/* GLOBAL LOB FILTER */}
          <div className="flex items-center gap-3 bg-m3-surface-variant/30 dark:bg-white/5 px-4 py-2 rounded-2xl border border-m3-surface-variant/50 dark:border-white/10 shadow-sm">
            <Filter size={16} className="text-m3-primary" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-gray-500 leading-none mb-1">Filtrar por Área</span>
              <select 
                value={selectedLob}
                onChange={(e) => setSelectedLob(e.target.value)}
                className="bg-transparent text-sm font-bold text-m3-secondary dark:text-white outline-none cursor-pointer min-w-[140px]"
              >
                <option value="all" className="bg-white dark:bg-[#1E1E1E]">Todos los LOBs</option>
                {lobs.map(lob => (
                  <option key={lob.id} value={lob.id} className="bg-white dark:bg-[#1E1E1E]">{lob.name}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {/* Content Area */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-[32px] min-h-[600px] shadow-sm border border-m3-surface-variant/50 dark:border-white/5 p-6 md:p-8 relative overflow-hidden transition-all duration-300">
                
                {/* Content Rendering Switch with selectedLob filter */}
                {activeSection === 'agents' && <AdminAgents selectedLob={selectedLob} />}
                {activeSection === 'users' && <AdminUsers selectedLob={selectedLob} />}
                {activeSection === 'processes' && <AdminProcessUpload selectedLob={selectedLob} />}
                {activeSection === 'quizzes' && <AdminQuizEditor selectedLob={selectedLob} />}
                {activeSection === 'manage-quizzes' && <AdminQuizManager selectedLob={selectedLob} />}
                {activeSection === 'assignments' && <AdminQuizAssigner selectedLob={selectedLob} />}
                {activeSection === 'acw' && <AdminAcwManager selectedLob={selectedLob} /> }
                {activeSection === 'acw-stats' && <AdminAcwStats selectedLob={selectedLob} /> }
                {activeSection === 'idle-report' && <AdminIdleReport selectedLob={selectedLob} /> }
                {activeSection === 'lob-manager' && <AdminLobManager /> }
                {activeSection === 'daily-history' && <AdminHistoryReport selectedLob={selectedLob} /> }
                {activeSection === 'glob-stats'  && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-6">
                      <Globe size={64} className="text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-m3-secondary dark:text-white">Consolidado Global</h3>
                    <p className="text-gray-500 max-w-sm mt-2">Próximamente: Panel de control unificado con métricas comparativas entre áreas.</p>
                  </div>
                )}

            </div>
            
            {/* Utility Quick Links - Redesigned */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {[
                 { label: 'Manual Agentes', url: '/pda-manual', color: 'bg-emerald-500' },
                 { label: 'Plan Ejecutivo', url: '/executive-plan', color: 'bg-indigo-500' },
                 { label: 'Repo. Vitals', url: '/executive-report/team-vitals', color: 'bg-m3-primary' },
                 { label: 'Evolutivo Dash', url: '/executive-report/hourly-trends', color: 'bg-purple-500' }
               ].map(link => (
                 <div key={link.label} className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl border border-m3-surface-variant/40 dark:border-white/10 shadow-sm flex items-center justify-between gap-3">
                   <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${link.color}`} />
                    <span className="text-xs font-bold text-m3-secondary dark:text-gray-300">{link.label}</span>
                   </div>
                   <button 
                    onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + link.url);
                        alert(`Enlace de ${link.label} copiado`);
                    }}
                    className="p-1.5 hover:bg-m3-surface-variant/50 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-400"
                   >
                     <ListChecks size={14} />
                   </button>
                 </div>
               ))}
            </div>
        </div>
      </main>
    </div>
  );
}
