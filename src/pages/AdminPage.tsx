import { useState, useEffect, useRef } from 'react';
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
  const [showExitModal, setShowExitModal] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(true);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  const adminGroups = [
    {
      id: 'equipo', label: 'Equipo', icon: Users,
      items: [
        { id: 'agents', label: 'Directorio de Agentes' },
        { id: 'users', label: 'Gestión de Accesos' },
      ]
    },
    {
      id: 'academy', label: 'Academy', icon: Library,
      items: [
        { id: 'processes', label: 'Carga de Contenido' },
        { id: 'quizzes', label: 'Crear Quiz' },
        { id: 'manage-quizzes', label: 'Gestionar Quizzes' },
        { id: 'assignments', label: 'Asignar Quizzes' },
      ]
    },
    {
      id: 'acw', label: 'ACW Lab', icon: Zap,
      items: [
        { id: 'acw', label: 'Simulador ACW' },
        { id: 'acw-stats', label: 'Métricas ACW' },
      ]
    },
    {
      id: 'reportes', label: 'Reportes', icon: BarChart3,
      items: [
        { id: 'idle-report', label: 'Reporte Disponibilidad' },
        { id: 'daily-history', label: 'Histórico Operativo' },
        { id: 'glob-stats', label: 'Consolidado Global' },
      ]
    },
    {
      id: 'sistema', label: 'Sistema', icon: Building2,
      items: [
        { id: 'lob-manager', label: 'Gestión de Áreas (LOB)' },
      ]
    }
  ];

  /* Helpers for finding the active section title */
  const activeGroup = adminGroups.find(g => g.items.some(i => i.id === activeSection)) || adminGroups[0];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (scrollContainerRef.current) {
        const lastScrollY = Number(scrollContainerRef.current.dataset.lastScrollY || 0);
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
            setIsScrollingUp(false);
        } else if (currentScrollY < lastScrollY) {
            setIsScrollingUp(true);
        }
        scrollContainerRef.current.dataset.lastScrollY = currentScrollY.toString();
    }
  };

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-screen overflow-y-auto bg-[#0A0A0A] text-gray-200 transition-colors duration-300 relative hide-scrollbar"
    >
      
      {/* Top Sub-Menu Float: Inteligente */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 px-4 py-2 rounded-full shadow-lg z-[150] whitespace-nowrap overflow-x-auto max-w-[95vw] hide-scrollbar transition-transform duration-300 ease-in-out ${isScrollingUp ? 'translate-y-0' : '-translate-y-[150%]'}`}>
         {activeGroup.items.map(item => (
            <button
               key={item.id}
               onClick={() => setActiveSection(item.id as AdminSection)}
               className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeSection === item.id 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                    : 'text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
               }`}
            >
               {item.label}
            </button>
         ))}
      </div>

      {/* Main Dock Navigation: z-[200] */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 px-6 py-4 rounded-full z-[200] shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-[float_4s_ease-in-out_infinite]">
         {adminGroups.map(group => {
            const isActive = activeGroup.id === group.id;
            return (
              <button 
                 key={group.id} 
                 onClick={() => setActiveSection(group.items[0].id as AdminSection)}
                 className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all cursor-pointer ${isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                 title={group.label}
              >
                <group.icon size={24} className={isActive ? 'text-blue-500' : ''} />
              </button>
            )
         })}

         {/* Salida Divider */}
         <div className="w-[1px] h-8 bg-white/10 mx-2" />

         <button 
            onClick={() => setShowExitModal(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-red-500/10 transition-all cursor-pointer text-gray-400 hover:text-red-400"
            title="Salida / Opciones"
         >
            <LogOut size={24} />
         </button>
      </div>

      {/* Exit Modal */}
      {showExitModal && (
         <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowExitModal(false)}>
            <div className="bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
               <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                 <LogOut className="text-red-500" /> Salida del Sistema
               </h3>
               <div className="space-y-3">
                 <button 
                    onClick={() => navigate('/home')}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors border border-white/5 shadow-sm"
                 >
                   <Eye size={18} /> Ir a Vista Agente
                 </button>
                 <button 
                    onClick={handleLogout}
                    className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                 >
                   <LogOut size={18} /> Cerrar Sesión Segura
                 </button>
               </div>
               <button onClick={() => setShowExitModal(false)} className="w-full mt-4 py-3 text-sm font-bold text-gray-500 hover:text-white transition-colors">
                  Cancelar
               </button>
            </div>
         </div>
      )}

      {/* Main Content */}
      <main className="w-full max-w-[100vw] mx-auto pt-28 pb-40 px-4 md:px-8 flex flex-col relative overflow-hidden">
        
        {/* Top bar with filter */}
        <header className="bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/10 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg mb-8">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600/10 rounded-xl border border-blue-500/20">
               <LayoutDashboard className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white px-2 md:px-0 tracking-tight">
                  {activeGroup.items.find(i => i.id === activeSection)?.label || 'Supervisor Hub'}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-2 md:px-0 mt-0.5">Admin Panel • {activeGroup.label}</p>
            </div>
          </div>

          {/* GLOBAL LOB FILTER */}
          <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 shadow-sm transition-colors hover:bg-white/10">
            <Filter size={16} className="text-blue-500" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-gray-400 tracking-widest leading-none mb-1">Filtrar por Área</span>
              <select 
                value={selectedLob}
                onChange={(e) => setSelectedLob(e.target.value)}
                className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer min-w-[140px] appearance-none"
              >
                <option value="all" className="bg-[#111] text-white">Todos los LOBs</option>
                {lobs.map(lob => (
                  <option key={lob.id} value={lob.id} className="bg-[#111] text-white">{lob.name}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <div className="flex-1 w-full">
            {/* Content Area */}
            <div className="bg-[#0A0A0A]/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/5 p-6 md:p-10 relative min-h-[600px] overflow-x-hidden transition-all duration-300">
                
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
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
               {[
                 { label: 'Manual Agentes', url: '/pda-manual', color: 'bg-emerald-500' },
                 { label: 'Plan Ejecutivo', url: '/executive-plan', color: 'bg-indigo-500' },
                 { label: 'Repo. Vitals', url: '/executive-report/team-vitals', color: 'bg-blue-500' },
                 { label: 'Evolutivo Dash', url: '/executive-report/hourly-trends', color: 'bg-purple-500' }
               ].map(link => (
                 <div key={link.label} className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 shadow-sm flex items-center justify-between gap-3 transition-all hover:bg-white/[0.04] hover:-translate-y-1">
                   <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)] ${link.color}`} />
                    <span className="text-sm font-semibold text-gray-300">{link.label}</span>
                   </div>
                   <button 
                    onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + link.url);
                        alert(`Enlace de ${link.label} copiado`);
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white"
                   >
                     <ListChecks size={18} />
                   </button>
                 </div>
               ))}
            </div>
        </div>
      </main>
    </div>
  );
}
