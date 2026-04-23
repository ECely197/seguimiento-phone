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
        <div className="max-w-6xl mx-auto px-4 md:px-0 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-500 pb-32">
            {/* Header Section */}
            <div className="bg-white/[0.02] backdrop-blur-2xl rounded-3xl border border-white/[0.05] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-8 transition-all">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                        <MessageSquare className="text-blue-500" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">Mis Chats</h2>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mt-2">Visor de Rendimiento Integral</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-4 md:mt-0">
                    <div className="relative group flex-1 md:flex-none">
                        <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <select 
                            className="pl-14 pr-6 py-4 rounded-full bg-transparent border border-white/10 font-bold text-sm w-full md:w-56 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-white appearance-none cursor-pointer"
                            value={week}
                            onChange={(e) => {
                                setWeek(e.target.value);
                                if (e.target.value) {
                                    setTimeout(() => handleSearchAuto(e.target.value), 0);
                                }
                            }}
                        >
                            <option value="" className="bg-[#111]">Selecciona Semana...</option>
                            {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                                <option key={w} value={String(w)} className="bg-[#111]">Semana {w}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={() => handleSearch()}
                        disabled={loading || !week.trim()}
                        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-4 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-500 font-bold text-sm animate-in zoom-in-95 duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                    <AlertCircle size={24} />
                    {error}
                </div>
            )}

            {/* Results Table */}
            <div className="bg-[#0A0A0A] rounded-3xl border border-white/10 shadow-xl overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/[0.02] backdrop-blur-md border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                            <tr>
                                {isClaims ? (
                                    <>
                                        <th className="px-6 py-5 whitespace-nowrap">FECHA</th>
                                        <th className="px-6 py-5 whitespace-nowrap">MOTIVO DE CONTACTO</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">PARTNER ID</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">TICKET</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">PSAT</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">AHT</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-5 whitespace-nowrap">INTERACCIÓN</th>
                                        <th className="px-6 py-5 whitespace-nowrap">CRONOLOGÍA</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">AHT</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">WUT</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">FRT</th>
                                        <th className="px-6 py-5 text-center whitespace-nowrap">PSAT</th>
                                        <th className="px-6 py-5 border-transparent"></th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                            {chats.length === 0 && !loading && !error && (
                                <tr>
                                    <td colSpan={7} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6 opacity-30">
                                            <Search size={64} className="text-gray-400" />
                                            <p className="text-sm font-black uppercase tracking-widest text-gray-500">
                                                {week ? `No se encontraron chats para la Semana ${week}` : 'Selecciona una semana para visualizar los datos'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {chats.map((chat, idx) => (
                                <tr key={idx} className="group hover:bg-white/[0.02] transition-colors duration-200">
                                    {isClaims ? (
                                        <>
                                            <td className="px-6 py-5 text-sm text-gray-200 font-medium whitespace-nowrap">{chat.fecha}</td>
                                            <td className="px-6 py-5 text-sm text-gray-400 whitespace-nowrap">{chat.contactReason}</td>
                                            <td className="px-6 py-5 text-sm text-gray-400 text-center whitespace-nowrap">{chat.partnerId}</td>
                                            <td className="px-6 py-5 text-sm text-gray-400 text-center whitespace-nowrap">{chat.ticket}</td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-xs border
                                                    ${chat.psat?.includes('100%') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                                      chat.psat?.includes('0%') ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                                      'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}
                                                `}>
                                                    <Smile size={14} /> {chat.psat}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[10px]">
                                                    <Clock size={12} /> {chat.aht}
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                                                        <Hash size={16} />
                                                    </div>
                                                    <span className="font-bold text-white text-sm">{chat.ticket}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-200 leading-none mb-2">{chat.fecha}</span>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sincronizado vía GViz</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-xs">
                                                    <Clock size={12} /> {chat.aht}s
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-xs">
                                                    <Clock size={12} /> {chat.wut}s
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold text-xs">
                                                    <Zap size={12} /> {chat.frt}s
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-xs border
                                                    ${chat.psat?.includes('100%') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                                      chat.psat?.includes('0%') ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                                      'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}
                                                `}>
                                                    <Smile size={14} /> {chat.psat}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right whitespace-nowrap">
                                                <ChevronRight size={18} className="text-gray-600 group-hover:text-blue-500 transition-colors" />
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
