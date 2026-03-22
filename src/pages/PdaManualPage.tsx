import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, XCircle, Rocket, BookOpen } from 'lucide-react';
import { auth } from '../firebaseConfig';

const SCENARIOS = [
  {
    title: '1. Validación Emocional (Conectar antes de resolver)',
    error: 'Entiendo tu problema. Para ver lo de tus pagos tienes que entrar al portal, ir a la opción de finanzas y chatear con ellos. ¿Te puedo ayudar en algo más?',
    correct: 'Comprendo tu urgencia por aclarar las dudas respecto al dinero, sin embargo, las finanzas al ser un tema delicado, debe ser gestionado por el área correcta, allí te podrán resolver todas las dudas que presentas.'
  },
  {
    title: '2. Postura de Ownership (Hacerte cargo)',
    error: 'Mira, nosotros somos soporte técnico y no podemos gestionar todo porque hay otras áreas que ven la parte de dinero. Tienes que esperar a que ellos te contacten.',
    correct: 'Te pido una disculpa, no estoy capacitado para poder atender tus consultas de finanzas, al ser un tema importante, esto lo trata un área especializada, para poderte contactar con ellos por favor sigue la siguiente ruta de ayuda.'
  },
  {
    title: '3. Agilidad y Burocracia (Hacerlo fácil)',
    error: 'Tengo el reporte de tus pedidos demorados. Prepárate para anotar los números: el primero es 1-9-2-0-5... ¿Ya lo tienes? El segundo es 1-9-2-0-7...',
    correct: 'Veo que cuentas con varias ordenes demoradas, no es necesario que me brindes los números completos, para ayudarte de una forma mas eficaz, indícame solo los últimos 4 dígitos por favor.'
  },
  {
    title: '4. Vocabulario de Asesor (Proyectar seguridad)',
    error: 'Eh... creo que ya dejé la nota en el sistema. Me parece que se va a solucionar pronto. Vamos a ver qué pasa mañana, ¿te parece bien?',
    correct: 'Te confirmo que la gestión ya fue realizada con éxito. El nuevo repartidor ya está asignado y se encuentra a pocos minutos de tu local. Puedes terminar de preparar el pedido con total seguridad.'
  },
  {
    title: '5. Cierre de Blindaje (Cuidar la métrica)',
    error: 'Listo, ya quedó cerrado el local por el problema de luz que me dijiste. Suerte con eso. Que tengas buen día, chau.',
    correct: 'Ya el local figura cerrado para que no te entren pedidos mientras no tienes luz. Me alegró mucho poder ayudarte hoy. Antes de irte, te agradecería valores la atención en la encuesta; así nos ayudarías a seguir mejorando.'
  }
];

export default function PdaManualPage() {
  const navigate = useNavigate();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check if user is logged out or visiting as guest
    setIsGuest(!auth.currentUser);
  }, []);

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-black p-4 pb-24 transition-colors duration-300 relative">
      <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <header className="flex flex-col gap-4 mb-2 mt-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-fit flex items-center gap-2 text-m3-primary font-bold text-sm hover:underline"
          >
            <ChevronLeft size={18} /> Volver
          </button>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800/30 flex-shrink-0">
                <BookOpen size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-m3-secondary dark:text-white tracking-tight">Manual de Tono, Voz y Postura</h1>
                <p className="text-m3-secondary/70 dark:text-gray-400 mt-1 max-w-lg leading-relaxed">
                  Conoce cómo llevar tu interacción al siguiente nivel. Estas 5 tarjetas muestran
                  la diferencia clave entre enfocarse en el problema o enfocarse en el cliente.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* 5 Scenario Cards */}
        <section className="space-y-6 pt-4">
          {SCENARIOS.map((card, idx) => (
            <div key={idx} className="bg-white dark:bg-[#1E1E1E] rounded-[24px] overflow-hidden shadow-sm border border-m3-surface-variant/50 dark:border-white/10">
              <div className="bg-m3-surface-variant/20 dark:bg-white/5 px-6 py-4 border-b border-m3-surface-variant/50 dark:border-white/10">
                <h2 className="text-lg font-bold text-m3-secondary dark:text-white">{card.title}</h2>
              </div>
              
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-m3-surface-variant/40 dark:divide-white/10">
                
                {/* Error Column */}
                <div className="p-6 bg-red-50/50 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={20} className="text-red-500" />
                    <h3 className="font-bold text-red-700 dark:text-red-400">Lo que debes evitar:</h3>
                  </div>
                  <p className="text-red-800/80 dark:text-red-200/70 text-sm leading-relaxed italic">
                    "{card.error}"
                  </p>
                </div>
                
                {/* Correct Column */}
                <div className="p-6 bg-green-50/50 dark:bg-green-900/5 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
                    <h3 className="font-bold text-green-700 dark:text-green-400">Cómo lo aplicas correctamente:</h3>
                  </div>
                  <p className="text-green-800/80 dark:text-green-200/70 text-sm leading-relaxed font-medium">
                    "{card.correct}"
                  </p>
                </div>
                
              </div>
            </div>
          ))}
        </section>

        {/* Action Button */}
        <div className="pt-8 pb-4">
          <button
            onClick={() => navigate('/acw')}
            className="w-full md:w-auto mx-auto flex items-center justify-center gap-3 py-4 px-10 bg-m3-primary text-white font-bold rounded-[24px] shadow-lg hover:bg-m3-primary/90 hover:scale-[1.02] active:scale-95 transition-all text-lg"
          >
            <Rocket size={24} /> ¡Listo! Quiero ir a practicar al ACW
          </button>
        </div>

        {/* Watermark/Footer for Guests */}
        {isGuest && (
          <div className="mt-16 border-t border-m3-surface-variant/40 dark:border-white/10 pt-6 text-center">
            <p className="text-sm font-medium text-m3-secondary/50 dark:text-gray-500 uppercase tracking-widest">
              Estás visualizando el Plan de Mejora - Equipo de Phone (Edwin)
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
