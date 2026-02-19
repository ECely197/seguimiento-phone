import { useState } from 'react';
import { Users, Library, FileEdit, Menu, LogOut, LayoutDashboard, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';

import AdminAgents from './AdminAgents';
import AdminQuizAssigner from './AdminQuizAssigner';
import AdminProcessUpload from './AdminProcessUpload';
import AdminQuizEditor from './AdminQuizEditor';
import AdminUsers from './AdminUsers';

type AdminSection = 'agents' | 'processes' | 'quizzes' | 'assignments' | 'users';

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('agents');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { id: 'agents', label: 'Gestión de Agentes', icon: Users },
    { id: 'users', label: 'Gestión de Usuarios', icon: Users },
    { id: 'processes', label: 'Carga de Contenido', icon: Library },
    { id: 'quizzes', label: 'Crear Quiz', icon: FileEdit },
    { id: 'assignments', label: 'Asignar Quizzes (Retos)', icon: CheckCircle },
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
              Supervisor<br/>Admin Panel
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

        <div className="space-y-4">
             <div className="px-4">
                <p className="text-xs text-gray-400 mb-1">Usuario Activo</p>
                <p className="text-sm font-medium text-m3-secondary dark:text-m3-on-surface-dark truncate">
                    {auth.currentUser?.email}
                </p>
             </div>
            <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[28px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium text-sm"
            >
                <LogOut size={20} />
                Cerrar Sesión
            </button>
        </div>
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
                    Panel de control exclusivo para supervisores.
                </p>
            </header>

            {/* Content Area */}
            <div className={`bg-white dark:bg-[#1E1E1E] rounded-[28px] min-h-[500px] shadow-sm border border-m3-surface-variant/50 dark:border-white/5 p-8 relative overflow-hidden transition-all duration-300 ${activeSection !== 'agents' ? 'ring-1 ring-m3-primary/10' : ''}`}>
                
                {/* Content Rendering Switch */}
                {activeSection === 'agents' && <AdminAgents />}
                {activeSection === 'users' && <AdminUsers />}
                {activeSection === 'processes' && <AdminProcessUpload />}
                {activeSection === 'quizzes' && <AdminQuizEditor />}
                {activeSection === 'assignments' && <AdminQuizAssigner />}

            </div>
        </div>
      </main>
    </div>
  );
}
