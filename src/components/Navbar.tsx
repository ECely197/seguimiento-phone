import { NavLink } from "react-router-dom";
import { Home, BookOpen, CheckCircle, Timer, Clock, MessageSquare, X } from "lucide-react";
import { usePermissions } from "../context/PermissionsContext";

interface NavbarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Navbar({ isOpen, onClose }: NavbarProps) {
  const { permissions, loading } = usePermissions();

  const navItems = [
    { name: "Inicio", path: "/home", icon: Home, show: true },
    { name: "Explicaciones", path: "/procesos", icon: BookOpen, show: permissions.canViewTraining },
    { name: "Práctica", path: "/quizzes", icon: CheckCircle, show: permissions.canViewQuizzes },
    { name: "ACW", path: "/acw", icon: Timer, show: permissions.canViewACW },
    { name: "Idle", path: "/idle-tracker", icon: Clock, show: permissions.canViewIdle },
    { name: "Mis Chats", path: "/mis-chats", icon: MessageSquare, show: permissions.canViewChats },
  ].filter(item => item.show);

  if (loading) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      <nav 
        className={`fixed inset-y-0 left-0 w-64 bg-[#0A0A0A] border-r border-white/5 z-50 transform transition-transform duration-300 md:translate-x-0 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col pt-20 pb-6 overflow-y-auto">
          {onClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-white/10 rounded-xl md:hidden transition-all"
            >
              <X size={24} />
            </button>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] pl-6 mb-2">Herramientas</span>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => { if (window.innerWidth < 768 && onClose) onClose(); }}
                className={({ isActive }) =>
                  `mx-3 flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-blue-600/10 text-blue-500 font-semibold border border-blue-500/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={20}
                      className={isActive ? "opacity-100" : "opacity-70"}
                    />
                    <span className="text-sm">
                      {item.name}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
