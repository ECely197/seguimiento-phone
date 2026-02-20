import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Loader2, Moon, Sun, UserPlus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ADMIN_UID } from '../constants';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let userCredential;
      if (isLoginView) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      
      if (userCredential.user.uid === ADMIN_UID) {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    } catch (err: any) {
      console.error("Auth failed:", err);
      if (err.code === 'auth/invalid-credential') {
        setError("Credenciales incorrectas.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("El correo ya está registrado.");
      } else if (err.code === 'auth/weak-password') {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("Error en la autenticación. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.uid === ADMIN_UID) {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    } catch (err: any) {
      console.error("Google login failed:", err);
      setError("Error al iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-m3-surface-dark flex items-center justify-center p-4 transition-colors duration-300">
      
      {/* Dark Mode Toggle */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full bg-m3-surface-variant/50 hover:bg-m3-surface-variant dark:bg-m3-secondary/20 dark:text-m3-on-surface-dark transition-all"
        aria-label="Toggle Dark Mode"
      >
        {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="bg-white dark:bg-[#2C2C2C] rounded-[28px] shadow-lg max-w-md w-full p-8 border border-m3-surface-variant/30 dark:border-m3-secondary/20 transition-colors duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-m3-primary/10 dark:bg-m3-primary-dark/20 p-4 rounded-full mb-4">
             {isLoginView ? (
                <LogIn className="text-m3-primary dark:text-m3-primary-dark" size={32} />
             ) : (
                <UserPlus className="text-m3-primary dark:text-m3-primary-dark" size={32} />
             )}
          </div>
          <h1 className="text-3xl font-bold text-m3-primary dark:text-m3-primary-dark text-center">
            {isLoginView ? 'Bienvenido' : 'Crear Cuenta'}
          </h1>
          <p className="text-m3-secondary dark:text-m3-on-surface-dark/70 text-sm text-center mt-2">
            {isLoginView ? 'Ingresa tus credenciales para continuar' : 'Regístrate para comenzar'}
          </p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-200 p-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                  <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="block px-4 pb-2.5 pt-4 w-full text-m3-secondary dark:text-m3-on-surface-dark bg-m3-surface-variant/30 dark:bg-black/20 rounded-t-lg border-b-2 border-m3-secondary/50 dark:border-m3-on-surface-dark/30 appearance-none focus:outline-none focus:ring-0 focus:border-m3-primary dark:focus:border-m3-primary-dark peer placeholder-transparent transition-colors"
                      placeholder=" "
                  />
                  <label 
                      htmlFor="email" 
                      className="absolute text-sm text-m3-secondary/70 dark:text-m3-on-surface-dark/60 duration-300 transform -translate-y-4 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-4 peer-focus:text-m3-primary dark:peer-focus:text-m3-primary-dark pointer-events-none"
                  >
                      Correo Electrónico
                  </label>
              </div>

              <div className="relative">
                  <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block px-4 pb-2.5 pt-4 w-full text-m3-secondary dark:text-m3-on-surface-dark bg-m3-surface-variant/30 dark:bg-black/20 rounded-t-lg border-b-2 border-m3-secondary/50 dark:border-m3-on-surface-dark/30 appearance-none focus:outline-none focus:ring-0 focus:border-m3-primary dark:focus:border-m3-primary-dark peer placeholder-transparent transition-colors"
                      placeholder=" "
                  />
                  <label 
                      htmlFor="password" 
                      className="absolute text-sm text-m3-secondary/70 dark:text-m3-on-surface-dark/60 duration-300 transform -translate-y-4 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-4 peer-focus:text-m3-primary dark:peer-focus:text-m3-primary-dark pointer-events-none"
                  >
                      Contraseña
                  </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-m3-primary dark:bg-m3-primary-dark text-white dark:text-m3-surface-dark font-medium py-3 rounded-full hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={20} className="animate-spin" />}
              {isLoginView ? "Iniciar Sesión" : "Registrarse"}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-m3-secondary/20 dark:border-m3-on-surface-dark/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#2C2C2C] px-2 text-m3-secondary/60 dark:text-m3-on-surface-dark/40">
                O continúa con
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white dark:bg-m3-surface-variant/10 text-m3-secondary dark:text-m3-on-surface-dark font-medium py-3 rounded-full border border-m3-secondary/30 dark:border-m3-on-surface-dark/20 hover:bg-m3-surface-variant/30 dark:hover:bg-m3-surface-variant/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </button>
        </div>
        
        <div className="mt-6 text-center">
            <button 
                onClick={() => setIsLoginView(!isLoginView)}
                className="text-sm text-m3-primary dark:text-m3-primary-dark hover:underline font-medium focus:outline-none"
            >
                {isLoginView 
                    ? "¿No tienes cuenta? Regístrate aquí" 
                    : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
        </div>

        <p className="text-center text-xs text-m3-secondary/60 dark:text-m3-on-surface-dark/40 mt-8">
            © 2026 PDA Humanizing App
        </p>
      </div>
    </div>
  );
}
