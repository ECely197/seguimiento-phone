import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Home, BookOpen, CheckCircle, Timer, Clock, MessageSquare, X, Menu, LogOut } from "lucide-react";
import { usePermissions } from "../context/PermissionsContext";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";

export default function FloatingNav() {
  const { permissions, loading, hideFloatingNav } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsOpen(false);
      navigate("/login");
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { name: "Inicio", path: "/home", icon: Home, show: true, delay: "0s" },
    { name: "Explicaciones", path: "/procesos", icon: BookOpen, show: permissions.canViewTraining, delay: "0.2s" },
    { name: "Práctica", path: "/quizzes", icon: CheckCircle, show: permissions.canViewQuizzes, delay: "0.4s" },
    { name: "ACW", path: "/acw", icon: Timer, show: permissions.canViewACW, delay: "0.6s" },
    { name: "Idle", path: "/idle-tracker", icon: Clock, show: permissions.canViewIdle, delay: "0.8s" },
    { name: "Mis Chats", path: "/mis-chats", icon: MessageSquare, show: permissions.canViewChats, delay: "1s" },
  ].filter(item => item.show);

  if (loading || hideFloatingNav) return null;

  return (
    <>
      {/* Desktop Dock */}
      <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 gap-6 z-[100]">
        {navItems.map((route) => (
          <NavLink 
            key={route.path}
            to={route.path} 
            className={({isActive}) => `
              w-16 h-16 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] 
              flex flex-col items-center justify-center text-gray-400 transition-all duration-300 hover:bg-white/20 hover:-translate-y-2 hover:text-white
              animate-[float_4s_ease-in-out_infinite] ${isActive ? 'bg-blue-600/30 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)] text-blue-400' : ''}
            `}
            style={{ animationDelay: route.delay }}
          >
            <route.icon size={24} />
            <span className="text-[10px] mt-1 font-medium select-none truncate overflow-hidden max-w-[80%] text-center">{route.name}</span>
          </NavLink>
        ))}
        {/* Logout Bubble */}
        <button
            onClick={handleLogout}
            className={`
              w-16 h-16 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] 
              flex flex-col items-center justify-center text-red-400 transition-all duration-300 hover:bg-red-500/20 hover:-translate-y-2 hover:border-red-500/30 hover:text-red-300
              animate-[float_4s_ease-in-out_infinite]
            `}
            style={{ animationDelay: "1.2s" }}
        >
            <LogOut size={24} />
            <span className="text-[10px] mt-1 font-medium select-none truncate overflow-hidden max-w-[80%] text-center">Salir</span>
        </button>
      </div>

      {/* Mobile Radial / FAB */}
      <div className="fixed bottom-6 right-6 md:hidden z-[100] flex flex-col-reverse items-center gap-4">
        {/* Burbuja Principal (Toggle) */}
        <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="w-14 h-14 rounded-full bg-blue-600 backdrop-blur-xl shadow-lg shadow-blue-500/30 flex items-center justify-center text-white transition-transform active:scale-90 animate-[float_4s_ease-in-out_infinite]"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Burbujas Hijas (Desplegables) */}
        <div className={`flex flex-col gap-4 transition-all duration-300 origin-bottom ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-10 pointer-events-none'}`}>
          {navItems.map((route, i) => (
            <NavLink 
                key={route.path}
                to={route.path}
                onClick={() => setIsOpen(false)}
                className={({isActive}) => `
                    w-12 h-12 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-colors
                    ${isActive ? 'bg-blue-600/50 text-blue-300 border-blue-500/50' : 'bg-[#111]/90 text-gray-400 hover:bg-white/20 hover:text-white'}
                `}
                style={{ transitionDelay: `${(navItems.length - i) * 50}ms` }}
            >
                <route.icon size={20} />
            </NavLink>
          ))}
          {/* Mobile Logout Bubble */}
          <button 
              onClick={handleLogout}
              className={`
                  w-12 h-12 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center text-red-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-colors bg-[#111]/90 hover:bg-red-500/20 hover:text-red-300
              `}
              style={{ transitionDelay: `0ms` }}
          >
              <LogOut size={20} />
          </button>
        </div>
      </div>
      
      {/* Overlay to close mobile menu */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
