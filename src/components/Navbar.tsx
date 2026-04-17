import { NavLink } from "react-router-dom";
import { Home, BookOpen, CheckCircle, Timer, Clock, MessageSquare } from "lucide-react";
import { usePermissions } from "../context/PermissionsContext";

export default function Navbar() {
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

  const cols = navItems.length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1E1E1E] border-t border-gray-200 dark:border-white/10 h-20 z-50 shadow-lg transition-colors duration-300">
      <div className={`grid h-full max-w-lg mx-auto`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center transition-all duration-300 ${
                isActive
                  ? "text-m3-primary dark:text-m3-primary-dark"
                  : "text-m3-secondary/60 dark:text-m3-on-surface-dark/40 hover:text-m3-primary dark:hover:text-m3-primary-dark"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-2 rounded-2xl mb-1 transition-all duration-300 ${
                    isActive ? "bg-m3-primary/10 dark:bg-m3-primary-dark/20 scale-110" : "bg-transparent"
                  }`}
                >
                  <item.icon
                    size={24}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
