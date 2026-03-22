import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Target, CalendarDays, ClipboardCheck, BookOpen, ExternalLink, Activity } from 'lucide-react';
import { auth } from '../firebaseConfig';

const WEEKS = [
  { 
    title: 'Semana 1: Diagnóstico', 
    desc: 'Auditoría inicial de llamadas e identificación de brechas en Validación y Ownership.',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/30'
  },
  { 
    title: 'Semana 2: Poder de la Voz', 
    desc: 'Talleres de Tono, Inflexión y Ritmo. Prácticas con Simulador ACW y Quizzes obligatorios para todos los agentes.',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/30'
  },
  { 
    title: 'Semana 3: Ownership', 
    desc: 'Focus en resolución al primer contacto y reducción de transferencias (Agilidad sin burocracia). Corrección en Roleplays.',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/30'
  },
  { 
    title: 'Semana 4: Certificación', 
    desc: 'Evaluación final de métricas PSAT y RES. Certificación de agentes que hayan adoptado el perfil "Asesor Experto".',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/30'
  }
];

export default function ExecutivePlanPage() {
  const navigate = useNavigate();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(!auth.currentUser);
  }, []);

  return (
    <div className="min-h-screen bg-m3-surface dark:bg-black p-4 pb-24 transition-colors duration-300 relative">
      <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <header className="flex flex-col gap-4 mb-2 mt-4 text-center items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="w-fit flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline absolute top-4 left-4 md:static md:self-start"
          >
            <ChevronLeft size={18} /> Volver
          </button>
          
          <div className="p-4 bg-indigo-600/10 dark:bg-indigo-500/10 rounded-full shadow-sm mb-4">
            <Target size={40} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-extrabold text-m3-secondary dark:text-white tracking-tight">
            Plan de Acción Tono, Voz y postura
          </h1>
          <p className="text-m3-secondary/70 dark:text-gray-400 max-w-2xl text-lg leading-relaxed">
            Estrategia integral para la implementación del PDA enfocado en elevar el 
            <span className="font-bold text-indigo-600 dark:text-indigo-400"> PSAT </span> y la 
            <span className="font-bold text-purple-600 dark:text-purple-400"> Resolución (RES)</span> del equipo de Phone.
          </p>
        </header>

        {/* Resumen Estratégico */}
        <section className="bg-white dark:bg-[#1E1E1E] rounded-[28px] p-6 md:p-8 shadow-sm border border-m3-surface-variant/50 dark:border-white/10 flex flex-col md:flex-row gap-6 items-start">
          <div className="md:w-1/3">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="text-indigo-500" size={24} />
              <h2 className="text-xl font-bold text-m3-secondary dark:text-white">Resumen Estratégico</h2>
            </div>
            <p className="text-sm text-m3-secondary/80 dark:text-gray-400 leading-relaxed mb-4">
              La meta es erradicar el scripting robótico. Transformaremos la operación 
              actual enfocándonos en la <strong>Validación</strong> del sentimiento del usuario y el 
              <strong> Ownership</strong> del caso.
            </p>
          </div>
          <div className="md:w-2/3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 p-5 rounded-2xl w-full">
            <h3 className="text-indigo-800 dark:text-indigo-300 font-bold mb-2">Impacto Directo Estimado</h3>
            <ul className="space-y-2 text-sm text-indigo-700/80 dark:text-indigo-200/80">
              <li className="flex items-start gap-2">
                <span className="mt-1">✅</span> Incremento en PSAT mediante conexiones humanas sólidas.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">✅</span> Aumento en RES (Resolución) al aplicar Ownership profundo.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">✅</span> Agilidad en gestión que reducirá el AHT indirectamente.
              </li>
            </ul>
          </div>
        </section>

        {/* Roadmap 4 Semanas */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-m3-surface-variant/40 dark:border-white/10 pb-3">
            <CalendarDays size={24} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-2xl font-bold text-m3-secondary dark:text-white">Cronograma (4 Semanas)</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {WEEKS.map((w, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border ${w.border} ${w.color} shadow-sm hover:shadow-md transition-shadow`}>
                <h3 className="font-extrabold text-lg mb-2">{w.title}</h3>
                <p className="opacity-90 leading-relaxed text-sm">{w.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Estrategia de Seguimiento */}
        <section className="bg-white dark:bg-[#1E1E1E] rounded-[28px] p-6 shadow-sm border border-m3-surface-variant/50 dark:border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardCheck size={24} className="text-emerald-500" />
            <h2 className="text-xl font-bold text-m3-secondary dark:text-white">Auditoría y Seguimiento</h2>
          </div>
          <p className="text-m3-secondary/80 dark:text-gray-400 text-sm leading-relaxed mb-6">
             El proceso se medirá semana a semana a través del <span className="font-bold text-m3-secondary dark:text-white">Reporte Ejecutivo unificado</span> de APIs. 
             Se realizarán intervenciones directas con los agentes mediante auditorías 1:1 basadas en audios reales. Se usarán 
             los Dashboards Evolutivos para identificar el impacto según turno e intervalo.
          </p>

          <div className="p-5 bg-m3-surface-variant/20 dark:bg-white/5 border border-m3-surface-variant/50 dark:border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-bold text-m3-secondary dark:text-white mb-1">Criterios de Evaluación</h3>
              <p className="text-xs text-m3-secondary/70 dark:text-gray-400 max-w-sm">
                Conoce la pauta exacta y los ejemplos de lo que se auditará en cada llamada (Lo que se debe evitar vs. La aplicación correcta).
              </p>
            </div>
            
            <button
              onClick={() => { window.open('/pda-manual', '_blank'); }}
              className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm"
            >
              <BookOpen size={18} /> Manual de Agentes <ExternalLink size={16} />
            </button>
          </div>
        </section>

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
