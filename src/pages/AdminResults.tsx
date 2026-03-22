import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, appId } from '../firebaseConfig';import { getPublicCollection, getUserCollection, getPublicDoc, getUserDoc, getAppStorageRef, fetchAllUsersSubcollection } from '../firebasePaths';

import { Trash2, Search, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface Result {
  id: string;
  agentEmail: string;
  quizId: string;
  isCorrect: boolean;
  audioUrl?: string;
  timestamp: any;
  // Augmented data
  agentName?: string;
  quizTitle?: string;
}

export default function AdminResults() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Results
      const allData = await fetchAllUsersSubcollection('resultados_quizzes');
      const sortedData = allData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      const resultsData = sortedData as unknown as Result[];

      // 2. Fetch Agents (to map email -> name)
      // Assuming 'users' collection or similar exists. If not, we use email.
      // Let's try to fetch from 'agents' collection if it exists (based on AdminAgents.tsx)
      // AdminAgents.tsx uses 'getAllAgents' which likely fetches from a collection.
      // We'll assume strict email matching for now. 
      // Ideally, we'd have a map of agents.
      const agentsSnap = await getDocs(collection(db, 'artifacts', appId, 'users')); 
      const agentMap: Record<string, string> = {};
      agentsSnap.forEach(doc => {
          const data = doc.data();
          if (data.email) agentMap[data.email] = data.name || data.agente || 'Agente';
      });

      // 3. Fetch Quizzes (to map quizId -> title)
      const quizzesSnap = await getDocs(getPublicCollection('quizzes'));
      const quizMap: Record<string, string> = {};
      quizzesSnap.forEach(doc => {
          quizMap[doc.id] = doc.data().situation || doc.data().title || 'Quiz Sin Título';
      });

      // 4. Merge Data
      const mergedResults = resultsData.map(r => ({
          ...r,
          agentName: agentMap[r.agentEmail] || r.agentEmail,
          quizTitle: quizMap[r.quizId] || 'Quiz Eliminado'
      }));

      setResults(mergedResults);

    } catch (err) {
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (result: any) => {
      if (!window.confirm("¿Estás seguro de habilitar un nuevo intento? Esto borrará el resultado actual.")) return;
      
      try {
          await deleteDoc(doc(db, result.path));
          setResults(prev => prev.filter(r => r.id !== result.id));
      } catch (err) {
          console.error("Error deleting result:", err);
          alert("Error al eliminar el resultado");
      }
  };

  const filteredResults = results.filter(r => 
      r.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.quizTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
        
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar por agente o quiz..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-[24px] bg-white dark:bg-[#2C2C2C] border border-m3-surface-variant/30 dark:border-white/10 outline-none focus:ring-2 focus:ring-m3-primary dark:text-white transition-all shadow-sm"
                />
            </div>
            <button 
                onClick={fetchData}
                className="p-3 bg-m3-primary/10 dark:bg-m3-primary/20 text-m3-primary rounded-full hover:bg-m3-primary/20 dark:hover:bg-m3-primary/30 transition-colors"
                title="Actualizar tabla"
            >
                <RefreshCw size={20} />
            </button>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto rounded-[28px] border border-m3-surface-variant/30 dark:border-white/10 bg-white dark:bg-m3-surface-dark shadow-sm">
            <table className="w-full text-left border-collapse">
                <thead className="bg-m3-surface-variant/40 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider">Agente</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider">Quiz</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">Resultado</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-center">Audio</th>
                        <th className="p-5 text-xs font-bold text-m3-secondary dark:text-m3-on-surface-dark uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-m3-surface-variant/20 dark:divide-white/5">
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="p-10 text-center">
                                <div className="flex justify-center items-center gap-3">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-m3-primary"></div>
                                    <span className="text-gray-500 dark:text-gray-400">Cargando resultados...</span>
                                </div>
                            </td>
                        </tr>
                    ) : filteredResults.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-10 text-center text-gray-400">
                                No se encontraron resultados.
                            </td>
                        </tr>
                    ) : (
                        filteredResults.map((result) => (
                            <tr key={result.id} className="group hover:bg-m3-surface-variant/10 dark:hover:bg-white/5 transition-colors">
                                <td className="p-5">
                                    <div>
                                        <p className="font-bold text-m3-secondary dark:text-white">{result.agentName}</p>
                                        <p className="text-xs text-gray-500">{result.agentEmail}</p>
                                    </div>
                                </td>
                                <td className="p-5">
                                    <p className="text-m3-secondary dark:text-gray-300 font-medium truncate max-w-[200px]" title={result.quizTitle}>
                                        {result.quizTitle}
                                    </p>
                                </td>
                                <td className="p-5 text-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                        result.isCorrect 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {result.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                        {result.isCorrect ? 'Aprobado' : 'Reprobado'}
                                    </span>
                                </td>
                                <td className="p-5 text-center">
                                    {result.audioUrl ? (
                                        <audio 
                                            src={result.audioUrl} 
                                            controls 
                                            className="w-48 h-8 mx-auto"
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Sin audio</span>
                                    )}
                                </td>
                                <td className="p-5 text-right">
                                    <button 
                                        onClick={() => handleDelete(result.id)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-xs font-bold"
                                        title="Eliminar resultado para permitir nuevo intento"
                                    >
                                        <Trash2 size={14} />
                                        Habilitar Intento
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
