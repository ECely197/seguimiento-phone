import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle, XCircle, ChevronDown, BookOpen, Mic, Activity, User, MessageCircle } from 'lucide-react';

const APROBADO_CRITERIA = [
  { title: 'Validación', description: 'Confirmación e interés genuino por escuchar la situación del cliente antes de saltar a la solución.' },
  { title: 'Ownership', description: 'Hacerse cargo del problema. Reflejar proactividad y disposición genuina a ayudar.' },
  { title: 'Vocabulario', description: 'Uso de un lenguaje claro, profesional pero cercano, sin tecnicismos innecesarios.' },
  { title: 'Cierre', description: 'Despedida amable, asegurando que no queden dudas y ofreciendo ayuda adicional si es necesario.' }
];

const NO_APROBADO_CRITERIA = [
  { title: 'Scripting', description: 'Suena robótico, leyendo un guion de forma artificial en lugar de tener una conversación natural.' },
  { title: 'Impotencia', description: 'Transmitir incapacidad de resolver el problema o desinterés total en buscar alternativas.' },
  { title: 'Burocracia', description: 'Enfocarse en procesos internos rígidos en vez de en la experiencia del cliente.' },
  { title: 'Tono Inadecuado', description: 'Sonar apático, cortante, a la defensiva o sin la energía necesaria.' }
];

const GLOSARIO = [
  { id: 'tono', title: 'Tono', icon: <Mic size={20} />, description: 'Es la emoción o intención detrás de la voz. Refleja la actitud del agente (empatía, urgencia, amabilidad). Un buen tono debe sonar dispuesto, tranquilo y humano.' },
  { id: 'inflexion', title: 'Inflexión', icon: <Activity size={20} />, description: 'Variación en la modulación de la voz. Evita sonar monótono; las inflexiones ayudan a resaltar información importante y hacer la plática dinámica y atractiva.' },
  { id: 'ritmo', title: 'Ritmo', icon: <MessageCircle size={20} />, description: 'Velocidad con la que se habla. Debe ser pausado para asegurar que el cliente entienda, pero lo suficientemente fluido para no parecer lento o inseguro.' },
  { id: 'postura', title: 'Postura', icon: <User size={20} />, description: 'Actitud general hacia el cliente y la interacción. Es la confianza, empatía profesional y el respeto proyectado, incluso ante situaciones difíciles o de frustración.' }
];

function Accordion({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-m3-surface-variant/50 dark:border-white/10 rounded-2xl overflow-hidden mb-3 bg-white dark:bg-[#1E1E1E]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-m3-surface-variant/20 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-m3-primary">{icon}</div>
          <span className="font-bold text-m3-secondary dark:text-m3-on-surface-dark text-base">{title}</span>
        </div>
        <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 text-sm text-m3-secondary/80 dark:text-gray-400 leading-relaxed border-t border-gray-50 dark:border-white/5 mx-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PdaCriteriaPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-black p-4 pb-24 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <header className="flex flex-col gap-4 mb-2 mt-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-fit flex items-center gap-2 text-m3-primary font-bold text-sm hover:underline"
          >
            <ChevronLeft size={18} /> Volver
          </button>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800/30">
              <BookOpen size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-m3-secondary dark:text-white tracking-tight">Criterios PDA</h1>
              <p className="text-m3-secondary/70 dark:text-gray-400 mt-1">Manual de evaluación para Tono, Voz y Postura (Phone)</p>
            </div>
          </div>
        </header>

        {/* Check Criterios - Grid */}
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          
          {/* Aprobado */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-green-200 dark:border-green-900/50">
              <CheckCircle size={22} className="text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-bold text-green-700 dark:text-green-300">Criterios de Aprobación</h2>
            </div>
            <div className="grid gap-3">
              {APROBADO_CRITERIA.map((crit, idx) => (
                <div key={idx} className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="font-extrabold text-green-800 dark:text-green-300 mb-1 flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" /> {crit.title}
                  </h3>
                  <p className="text-sm text-green-700/80 dark:text-green-200/70">{crit.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* No Aprobado */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200 dark:border-red-900/50">
              <XCircle size={22} className="text-red-500 dark:text-red-400" />
              <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Puntos de No Aprobación</h2>
            </div>
            <div className="grid gap-3">
              {NO_APROBADO_CRITERIA.map((crit, idx) => (
                <div key={idx} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="font-extrabold text-red-800 dark:text-red-300 mb-1 flex items-center gap-2">
                    <XCircle size={14} className="text-red-500" /> {crit.title}
                  </h3>
                  <p className="text-sm text-red-700/80 dark:text-red-200/70">{crit.description}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Glosario T\u00e9cnico */}
        <section className="pt-8">
          <h2 className="text-2xl font-bold text-m3-secondary dark:text-white mb-6">Glosario Técnico</h2>
          <div>
            {GLOSARIO.map(item => (
              <Accordion key={item.id} title={item.title} icon={item.icon}>
                {item.description}
              </Accordion>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
