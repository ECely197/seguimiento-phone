import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, LogOut, LayoutDashboard } from "lucide-react";

export default function Header() {
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
    <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 z-50 transition-colors duration-300">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-m3-primary/10 rounded-lg">
          <LayoutDashboard className="text-m3-primary" size={20} />
        </div>
        <span className="font-bold text-m3-secondary dark:text-m3-on-surface-dark tracking-tight">Gestión Team</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-m3-secondary dark:text-m3-on-surface-dark hover:bg-m3-primary/5 transition-colors"
          title="Cambiar Tema"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1" />

        <button
          onClick={handleLogout}
          className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Cerrar Sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
