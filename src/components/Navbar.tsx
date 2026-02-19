import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, BookOpen, CheckCircle, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { name: "Inicio", path: "/home", icon: Home },
    { name: "Capacitación", path: "/procesos", icon: BookOpen },
    { name: "Práctica", path: "/quizzes", icon: CheckCircle },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-m3-surface dark:bg-[#0F0F0F] border-t border-m3-surface-variant dark:border-white/10 h-20 flex justify-around items-center z-50 shadow-sm transition-colors duration-300">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
              isActive
                ? "text-m3-primary dark:text-m3-primary-dark"
                : "text-m3-secondary dark:text-m3-on-surface-dark/60 hover:text-m3-primary/70 dark:hover:text-m3-primary-dark/80"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`p-1 rounded-full mb-1 transition-all ${
                  isActive ? "bg-m3-primary/10 dark:bg-m3-primary-dark/20" : "bg-transparent"
                }`}
              >
                <item.icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-transform duration-200"
                />
              </div>
              <span className="text-xs font-medium tracking-wide">
                {item.name}
              </span>
            </>
          )}
        </NavLink>
      ))}
      
      {/* Right Side Actions: Theme & Logout */}
       <div className="absolute right-4 top-1/2 -translate-y-1/2 md:static md:translate-y-0 flex items-center gap-1"> 
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-m3-secondary dark:text-m3-on-surface-dark hover:bg-m3-primary/10 transition-colors"
            title="Cambiar Tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="h-6 w-px bg-m3-surface-variant dark:bg-white/10 mx-1" />

          <button
            onClick={handleLogout}
            className="p-2 rounded-full text-[var(--color-m3-error)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
      </div>
    </nav>
  );
}
