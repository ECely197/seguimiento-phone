import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, LogOut, LayoutDashboard, Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 sm:px-6 z-40 transition-colors duration-300 md:pl-[17rem]">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white md:hidden transition-all"
          >
            <Menu size={24} />
          </button>
        )}
        <div className="p-1.5 bg-blue-600/10 rounded-lg hidden sm:block border border-blue-500/20">
          <LayoutDashboard className="text-blue-500" size={20} />
        </div>
        <span className="font-bold text-white tracking-tight text-lg">PedidosYa Admin</span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          title="Cambiar Tema"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

        <button
          onClick={handleLogout}
          className="p-2 rounded-full text-red-500 hover:bg-red-500/10 transition-colors"
          title="Cerrar Sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
