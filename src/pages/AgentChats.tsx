import { useState, useEffect } from 'react';
import { MessageSquare, Search, Loader2, Calendar, Hash, Clock, Zap, Smile, AlertCircle, ChevronRight } from 'lucide-react';
import { auth, db } from '../firebaseConfig';
import { getDoc } from 'firebase/firestore';
import { getUserDoc, getPublicDoc } from '../firebasePaths';
import { fetchAgentChats } from '../api/gvizService';
import { onAuthStateChanged } from 'firebase/auth';

export default function AgentChats() {
    const [chats, setChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [week, setWeek] = useState('');
    const [lobConfig, setLobConfig] = useState<any>(null);
    const [userEmail, setUserEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user?.email) {
                setUserEmail(user.email);
                try {
                    const uSnap = await getDoc(getUserDoc(user.uid));
                    const lobId = uSnap.data()?.lob;
                    if (lobId) {
                        const lSnap = await getDoc(getPublicDoc('lobs', lobId));
                        setLobConfig(lSnap.data());
                    }
                } catch (err) {
                    console.error("Error loading config:", err);
                    setError("Error al cargar la configuración del área.");
                }
            }
            setInitialLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSearch = async (e?: React.FormEvent, customWeek?: string) => {
        if (e) e.preventDefault();
        const weekToSearch = (customWeek || week).trim();
        if (!weekToSearch) return;
        
        if (!lobConfig?.chatsSpreadsheetId || !lobConfig?.chatsSheetName) {
            setError("Tu área aún no tiene una base de datos asignada. Contacta a tu supervisor.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const results = await fetchAgentChats(
                lobConfig.chatsSpreadsheetId,
                lobConfig.chatsSheetName,
                userEmail,
                weekToSearch,
                lobConfig.name || ''
            );
            setChats(results);
            if (results.length === 0) {
                setError(`No se encontraron chats para la Semana ${weekToSearch}.`);
            }
        } catch (err) {
            setError("Error al consultar la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearchAuto = (selectedWeek: string) => {
        handleSearch(undefined, selectedWeek);
    };

    const isClaims = (lobConfig?.name || '').toLowerCase() === 'claims';

    if (initialLoading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="animate-spin text-m3-primary" size={32} />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sincronizando tus Chats...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 pb-20">
            {/* Header Section */}
            <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] border border-m3-surface-variant/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                <div className="flex items-center gap-5">
                    <div className="p-5 bg-m3-primary/10 rounded-[28px] ring-4 ring-m3-primary/5">
                        <MessageSquare className="text-m3-primary" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-m3-secondary dark:text-white leading-tight">Mis Chats</h2>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Visor de Rendimiento por Interacción</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-m3-primary transition-colors" size={18} />
                        <select 
                            className="pl-12 pr-6 py-4 rounded-2xl bg-m3-surface-variant/10 dark:bg-black/20 border border-m3-surface-variant/30 dark:border-white/5 font-black text-sm w-56 focus:ring-4 focus:ring-m3-primary/10 transition-all outline-none dark:text-white appearance-none cursor-pointer"
                            value={week}
                            onChange={(e) => {
                                setWeek(e.target.value);
                                if (e.target.value) {
                                    // Trigger search immediately
                                    setTimeout(() => handleSearchAuto(e.target.value), 0);
                                }
                            }}
                        >
                            <option value="" className="dark:bg-[#1E1E1E]">Selecciona Semana...</option>
                            {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                                <option key={w} value={String(w)} className="dark:bg-[#1E1E1E]">Semana {w}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={() => handleSearch()}
                        disabled={loading || !week.trim()}
                        className="p-4 bg-m3-primary text-white rounded-2xl shadow-lg shadow-m3-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <Search size={24} />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-[28px] text-rose-600 dark:text-rose-400 font-bold text-sm animate-in zoom-in-95 duration-300">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Results Table */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-[40px] border border-m3-surface-variant/30 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-m3-surface-variant/10 dark:bg-white/5 border-b border-m3-surface-variant/20">
                                {isClaims ? (
                                    <>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400">FECHA</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400">MOTIVO DE CONTACTO (CCR3)</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">PARTNER ID</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">TICKET</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">PSAT</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">AHT</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400">INTERACCIÓN</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400">CRONOLOGÍA</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">AHT</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">WUT</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">FRT</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-m3-secondary/60 dark:text-gray-400 text-center">PSAT</th>
                                        <th className="px-6 py-6 border-transparent"></th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-m3-surface-variant/10">
                            {chats.length === 0 && !loading && !error && (
                                <tr>
                                    <td colSpan={7} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                            <Search size={48} className="text-gray-400" />
                                            <p className="text-sm font-black uppercase tracking-widest text-gray-500">
                                                {week ? `No se encontraron chats para la Semana ${week}` : 'Selecciona una semana para visualizar los datos'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {chats.map((chat, idx) => (
                                <tr key={idx} className="group hover:bg-m3-primary/[0.02] dark:hover:bg-m3-primary/5 transition-colors duration-200">
                                    {isClaims ? (
                                        <>
                                            <td className="px-8 py-6 text-sm text-m3-secondary dark:text-gray-300 font-bold">{chat.fecha}</td>
                                            <td className="px-8 py-6 text-sm text-m3-secondary dark:text-gray-300">{chat.contactReason}</td>
                                            <td className="px-8 py-6 text-sm text-m3-secondary dark:text-gray-300 text-center">{chat.partnerId}</td>
                                            <td className="px-8 py-6 text-sm text-m3-secondary dark:text-gray-300 text-center">{chat.ticket}</td>
                                            <td className="px-8 py-6 text-center">
                                                <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-xl font-black text-xs shadow-sm
                                                    ${chat.psat?.includes('100%') ? 'bg-emerald-500 text-white' : 
                                                      chat.psat?.includes('0%') ? 'bg-rose-500 text-white' : 
                                                      'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}
                                                `}>
                                                    <Smile size={14} /> {chat.psat}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-black text-[10px]">
                                                    <Clock size={12} /> {chat.aht}
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
                                                        <Hash size={16} />
                                                    </div>
                                                    <span className="font-black text-m3-secondary dark:text-white dark:text-opacity-90">{chat.ticket}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-m3-secondary dark:text-white uppercase leading-none mb-1">{chat.fecha}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Sincronizado vía GViz</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-black text-[10px]">
                                                    <Clock size={12} /> {chat.aht}s
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 font-black text-[10px]">
                                                    <Clock size={12} /> {chat.wut}s
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 font-black text-[10px]">
                                                    <Zap size={12} /> {chat.frt}s
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-xl font-black text-xs shadow-sm
                                                    ${chat.psat?.includes('100%') ? 'bg-emerald-500 text-white' : 
                                                      chat.psat?.includes('0%') ? 'bg-rose-500 text-white' : 
                                                      'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}
                                                `}>
                                                    <Smile size={14} /> {chat.psat}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <ChevronRight size={18} className="text-gray-300 group-hover:text-m3-primary transition-colors" />
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
