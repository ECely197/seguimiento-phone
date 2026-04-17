import { getPublicCollection } from '../firebasePaths';
import { getDocs } from 'firebase/firestore';

// ── Legacy API URLs (Fallbacks) ──────────────────────────────────────────────────
const PRIMARY_URL  = import.meta.env.VITE_SHEETDB_URL          as string | undefined;
const RECUPERO_URL = import.meta.env.VITE_RECUPERO_SCRIPT_URL  as string | undefined;
const B2X_URL      = import.meta.env.VITE_B2X_SCRIPT_URL       as string | undefined;
const HISTORICO_URL = import.meta.env.VITE_HISTORICO_URL       as string | undefined;

// ── Exported types ─────────────────────────────────────────────────────────────
export interface AgentResponse {
  lob: string;
  name: string;
  headers: string[];
  metrics: any[];
  sugerencia?: string;
  rawMetrics?: Record<string, any>;
}

export interface AgentHistory {
  history: {
    [date: string]: {
      aht: any;
      frt: any;
      acw: any;
      psat: any;
      kpi5?: any;
      [key: string]: any;
    };
  };
}

export interface LobConfig {
  id: string;
  name: string;
  apiUrl: string;
  permissions: {
    capacitaciones: boolean;
    quizzes: boolean;
    acw: boolean;
    idle_tracker: boolean;
    metrics: boolean;
  };
}

// ── Mappers ───────────────────────────────────────────────────────────────────

const mapMainAgent = (raw: any) => ({
  correo:           raw.correo          ?? raw.Correo          ?? raw.B  ?? '',
  'AHT Real':       raw['AHT Real']     ?? raw.ahtReal         ?? raw.F  ?? '',
  ATT:              raw.ATT             ?? raw.att             ?? raw.G  ?? '',
  ACW:              raw.ACW             ?? raw.acw             ?? raw.H  ?? '',
  RES:              raw.RES             ?? raw.res             ?? raw.J  ?? '',
  PSAT:             raw.PSAT            ?? raw.psat            ?? raw.N  ?? '',
  'No contestada':  raw['No contestada']?? raw.noContestada    ?? raw.R  ?? '',
});

const mapB2xAgent = (raw: any) => {
  if (Array.isArray(raw?.metrics)) {
    const m = raw.metrics;
    return {
      correo: raw.correo ?? raw.Correo ?? raw.email ?? '',
      AHT:    m[0] ?? '',
      FRT:    m[1] ?? '',
      ACW:    m[2] ?? '',
      SAT:    m[6] ?? '',
    };
  }
  return {
    correo: raw.correo ?? raw.Correo ?? raw.email ?? raw.Email ?? raw.A ?? raw.B ?? '',
    AHT:    raw.AHT    ?? raw.aht    ?? raw.C ?? '',
    FRT:    raw.FRT    ?? raw.frt    ?? raw.D ?? '',
    ACW:    raw.ACW    ?? raw.acw    ?? raw.E ?? '',
    SAT:    raw.SAT    ?? raw.sat    ?? raw.I ?? '',
    KPI5:   raw.KPI5   ?? raw.kpi5   ?? raw.M ?? '',
  };
};

const mapRecuperoAgent = (raw: any) => {
  if (Array.isArray(raw?.metrics)) {
    const m = raw.metrics;
    return {
      correo:                  raw.correo ?? raw.Correo ?? raw.email ?? '',
      'Tot. Llamadas':         m[0] ?? '',
      Efectiva:                m[1] ?? '',
      'HS Gestionadas':        m[2] ?? '',
      'Prod. Tot. Llamadas':   m[3] ?? '',
      Cuartil1:                m[4] ?? '',
      'Prod. Tot. Efectivas':  m[5] ?? '',
      Cuartil2:                m[6] ?? '',
    };
  }
  return {
    correo:                  raw.correo                   ?? raw.A ?? '',
    'Tot. Llamadas':         raw['Tot. Llamadas']         ?? raw.totLlamadas       ?? raw.B ?? '',
    Efectiva:                raw.Efectiva                 ?? raw.efectiva          ?? raw.C ?? '',
    'HS Gestionadas':        raw['HS Gestionadas']        ?? raw.hsGestionadas     ?? raw.D ?? '',
    'Prod. Tot. Llamadas':   raw['Prod. Tot. Llamadas']   ?? raw.prodTotLlamadas   ?? raw.E ?? '',
    Cuartil1:                raw.Cuartil1                 ?? raw.cuartil1          ?? raw.F ?? '',
    'Prod. Tot. Efectivas':  raw['Prod. Tot. Efectivas']  ?? raw.prodTotEfectivas  ?? raw.G ?? '',
    Cuartil2:                raw.Cuartil2                 ?? raw.cuartil2          ?? raw.H ?? '',
  };
};

// Generic mapper for generic LOBs (based on Phone format)
const mapGenericAgent = (raw: any) => {
  const emailVal = raw.correo ?? raw.Correo ?? raw.email ?? raw.Email ?? raw.A ?? raw.B ?? '';
  const nameVal = raw.agente ?? raw.Agente ?? raw.name ?? raw.Name ?? raw.C ?? '';
  
  // Extract all keys except email/name related ones for metrics
  const headers = Object.keys(raw).filter(k => 
    !['correo', 'Correo', 'email', 'Email', 'agente', 'Agente', 'name', 'Name', 'A', 'B', 'C'].includes(k)
  );

  const mapped: any = { correo: emailVal };
  headers.forEach(h => { mapped[h] = raw[h]; });

  return { mapped, name: nameVal, headers };
};

// ── Internal Helpers ──────────────────────────────────────────────────────────

const fetchAllFromUrl = async (baseUrl: string | undefined, label: string): Promise<any[]> => {
  if (!baseUrl) return [];
  try {
    const res = await fetch(baseUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.agents)) return json.agents;
    if (Array.isArray(json?.rows)) return json.rows;
    if (json && typeof json === 'object') {
       return Object.entries(json).map(([k, v]: [string, any]) => ({ correo: k, email: k, ...(typeof v === 'object' ? v : { data: v }) }));
    }
    return [];
  } catch (err) {
    console.warn(`[sheetService] ${label} failed:`, err);
    return [];
  }
};

const emailOf = (raw: any): string =>
  (raw?.correo ?? raw?.Correo ?? raw?.email ?? raw?.Email ?? raw?.A ?? '')
    .toString().trim().toLowerCase();

// ── Public API ────────────────────────────────────────────────────────────────

export const getAgentData = async (email: string, dynamicUrl?: string): Promise<AgentResponse | null> => {
  const target = email.trim().toLowerCase();
  
  // 1. If dynamicUrl is provided (e.g. from current LOB doc), try it first
  if (dynamicUrl) {
    const raw = await fetchAllFromUrl(dynamicUrl, 'DynamicLOB');
    const match = raw.find(row => emailOf(row) === target);
    if (match) {
        const { mapped, name, headers } = mapGenericAgent(match);
        return {
            lob: 'dynamic', // Or pass it as arg
            name: String(name || match.email || match.correo || ''),
            headers,
            metrics: headers.map(h => (mapped as any)[h]),
            sugerencia: match.sugerencia || match.Sugerencia || '',
            rawMetrics: mapped
        };
    }
  }

  // 1. Fetch Dynamic LOB configurations from Firestore
  let dynamicLobs: LobConfig[] = [];
  try {
    const snap = await getDocs(getPublicCollection('lobs'));
    dynamicLobs = snap.docs.map(d => ({ id: d.id, ...d.data() } as LobConfig));
  } catch (e) {
    console.warn("[sheetService] Failed to fetch dynamic lobs, falling back to env.");
  }

  // 2. Fetch from all sources
  // We combine dynamic LOBs + legacy ones
  const sources = [
    { id: 'phone',    url: PRIMARY_URL },
    { id: 'recupero', url: RECUPERO_URL },
    { id: 'b2x',      url: B2X_URL },
    ...dynamicLobs.filter(l => !['phone', 'recupero', 'b2x'].includes(l.id)).map(l => ({ id: l.id, url: l.apiUrl }))
  ].filter(s => !!s.url);

  const results = await Promise.all(sources.map(s => fetchAllFromUrl(s.url, `LOB/${s.id}`)));

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const data = results[i];
    const match = data.find(row => emailOf(row) === target);

    if (match) {
      if (source.id === 'phone') {
        const mapped = mapMainAgent(match);
        const headers = Object.keys(mapped).filter(k => k !== 'correo');
        return {
          lob: 'phone',
          name: String(match.agente ?? match.Agente ?? match.C ?? ''),
          headers,
          metrics: headers.map(h => mapped[h as keyof typeof mapped]),
          sugerencia: match.sugerencia ?? match.Sugerencia ?? '',
          rawMetrics: mapped
        };
      }
      if (source.id === 'recupero') {
        const mapped = mapRecuperoAgent(match);
        const headers = Object.keys(mapped).filter(k => k !== 'correo');
        return {
          lob: 'recupero',
          name: String(match.correo ?? match.Correo ?? ''),
          headers,
          metrics: headers.map(h => mapped[h as keyof typeof mapped]),
          sugerencia: match.sugerencia ?? match.Sugerencia ?? '',
          rawMetrics: mapped
        };
      }
      if (source.id === 'b2x') {
        const mapped = mapB2xAgent(match);
        const headers = Object.keys(mapped).filter(k => k !== 'correo');
        return {
          lob: 'b2x',
          name: String(match.agente ?? match.Agente ?? match.name ?? match.B ?? ''),
          headers,
          metrics: headers.map(h => mapped[h as keyof typeof mapped]),
          sugerencia: match.sugerencia ?? match.Sugerencia ?? '',
          rawMetrics: mapped
        };
      }

      // Default for dynamic LOBs
      const { mapped, name, headers } = mapGenericAgent(match);
      return {
        lob: source.id,
        name: String(name || match.email || match.correo || ''),
        headers,
        metrics: headers.map(h => (mapped as any)[h]),
        sugerencia: match.sugerencia || match.Sugerencia || '',
        rawMetrics: mapped
      };
    }
  }

  return null;
};

export const getAgentHistory = async (email: string, dynamicUrl?: string): Promise<AgentHistory | null> => {
  const targetUrl = dynamicUrl || HISTORICO_URL;
  if (!targetUrl) return null;
  try {
    const target = email.trim().toLowerCase();
    const res = await fetch(`${targetUrl}?email=${target}`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as AgentHistory;
  } catch (err) {
    return null;
  }
};

export const updateAgentSuggestion = async (email: string, suggestion: string): Promise<any> => {
  const target = email.trim().toLowerCase();
  
  // Probe to find the correct URL
  const agent = await getAgentData(target);
  if (!agent) throw new Error("Agent not found.");

  // Find URL for this LOB
  let targetUrl = PRIMARY_URL;
  if (agent.lob === 'recupero') targetUrl = RECUPERO_URL;
  else if (agent.lob === 'b2x') targetUrl = B2X_URL;
  else {
     // Check dynamic
     try {
       const snap = await getDocs(getPublicCollection('lobs'));
       const l = snap.docs.find(d => d.id === agent.lob);
       if (l) targetUrl = l.data().apiUrl;
     } catch(e) {}
  }

  if (!targetUrl) throw new Error('No API URL configured for this LOB.');

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'update', correo: email.trim(), sugerencia: suggestion }),
    redirect: 'follow',
  });
  return res.json();
};

export const getMainAgents = () => fetchAllFromUrl(PRIMARY_URL, 'Main').then(r => r.map(mapMainAgent));
export const getRecuperoAgents = () => fetchAllFromUrl(RECUPERO_URL, 'Recupero').then(r => r.map(mapRecuperoAgent));
export const getB2xAgents = () => fetchAllFromUrl(B2X_URL, 'B2X').then(r => r.map(mapB2xAgent));
export const getAllAgents = async () => [...(await getMainAgents()), ...(await getRecuperoAgents()), ...(await getB2xAgents())];
