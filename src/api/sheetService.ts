// ── API URLs ───────────────────────────────────────────────────────────────────
// All variables must be set in .env.local (dev) AND in Vercel dashboard (prod).
// Vite only exposes vars prefixed with VITE_ to the browser bundle.
const PRIMARY_URL  = import.meta.env.VITE_SHEETDB_URL          as string | undefined;
const RECUPERO_URL = import.meta.env.VITE_RECUPERO_SCRIPT_URL  as string | undefined;
const B2X_URL      = import.meta.env.VITE_B2X_SCRIPT_URL       as string | undefined;
const HISTORICO_URL = import.meta.env.VITE_HISTORICO_URL       as string | undefined;

// ── Exported type ──────────────────────────────────────────────────────────────
export interface AgentResponse {
  lob: string;
  name: string;
  headers: string[];
  metrics: any[];
  sugerencia?: string;
  rawMetrics?: Record<string, any>; // Added for direct access to metrics like AHT, SAT, etc.
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


// ══════════════════════════════════════════════════════════════════════════════
//  Column mappers — explicit, no leaking extra columns into the UI
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Phone mapper.
 * Reads named keys first, then falls back to letter-keyed columns.
 * Returns only the 8 agreed columns (correo excluded from metrics).
 */
const mapMainAgent = (raw: any) => ({
  correo:           raw.correo          ?? raw.Correo          ?? raw.B  ?? '',
  'AHT Real':       raw['AHT Real']     ?? raw.ahtReal         ?? raw.F  ?? '',
  ATT:              raw.ATT             ?? raw.att             ?? raw.G  ?? '',
  ACW:              raw.ACW             ?? raw.acw             ?? raw.H  ?? '',
  RES:              raw.RES             ?? raw.res             ?? raw.J  ?? '',
  PSAT:             raw.PSAT            ?? raw.psat            ?? raw.N  ?? '',
  'No contestada':  raw['No contestada']?? raw.noContestada    ?? raw.R  ?? '',
});

/**
 * B2X mapper.
 * Maps the specific B2X columns:
 *   C = AHT, D = FRT, E = ACW, I = SAT
 * Falls back to named keys or letter-keyed columns.
 */
const mapB2xAgent = (raw: any) => {
  // If the API returns a metrics array
  if (Array.isArray(raw?.metrics)) {
    const m = raw.metrics;
    return {
      correo: raw.correo ?? raw.Correo ?? raw.email ?? '',
      AHT:    m[0] ?? '',   // Column C (index 0 after correo/name)
      FRT:    m[1] ?? '',   // Column D
      ACW:    m[2] ?? '',   // Column E
      SAT:    m[6] ?? '',   // Column I
    };
  }

  // Named or letter-keyed object
  return {
    correo: raw.correo ?? raw.Correo ?? raw.email ?? raw.Email ?? raw.A ?? raw.B ?? '',
    AHT:    raw.AHT    ?? raw.aht    ?? raw.C ?? '',
    FRT:    raw.FRT    ?? raw.frt    ?? raw.D ?? '',
    ACW:    raw.ACW    ?? raw.acw    ?? raw.E ?? '',
    SAT:    raw.SAT    ?? raw.sat    ?? raw.I ?? '',
    KPI5:   raw.KPI5   ?? raw.kpi5   ?? raw.M ?? '', // Assuming M or named
  };
};

/**
 * Recupero mapper.
 * The API wraps row values in a `metrics` array:
 *   { correo: "...", metrics: ["150", "120", "8", "18.75", "Q1", "15", "Q2"] }
 * Falls back to named-key / letter-key formats if metrics[] is absent.
 */
const mapRecuperoAgent = (raw: any) => {
  // Primary format: metrics array (index-based)
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

  // Fallback: comma-joined string in a single field
  const asString =
    typeof raw === 'string' ? raw
    : typeof raw.data === 'string' ? raw.data
    : null;

  if (asString) {
    const p = asString.split(',').map((s: string) => s.trim());
    return {
      correo:                  p[0] ?? '',
      'Tot. Llamadas':         p[1] ?? '',
      Efectiva:                p[2] ?? '',
      'HS Gestionadas':        p[3] ?? '',
      'Prod. Tot. Llamadas':   p[4] ?? '',
      Cuartil1:                p[5] ?? '',
      'Prod. Tot. Efectivas':  p[6] ?? '',
      Cuartil2:                p[7] ?? '',
    };
  }

  // Fallback: named or letter-keyed object
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


// ── Internal: fetch all rows from one URL, returning raw objects ──────────────
const fetchAllFromUrl = async (baseUrl: string | undefined, label: string): Promise<any[]> => {
  // Guard: skip silently if the env var wasn't set (avoids HTML-as-JSON error)
  if (!baseUrl) {
    console.warn(`[sheetService] ${label}: URL is undefined — check Vercel environment variables.`);
    return [];
  }
  try {
    console.log(`[sheetService] ${label}: Cargando desde env...`);
    const res = await fetch(baseUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log(`[sheetService] ${label} raw:`, json);

    if (Array.isArray(json))         return json;
    if (Array.isArray(json?.data))   return json.data;
    if (Array.isArray(json?.agents)) return json.agents;
    if (Array.isArray(json?.rows))   return json.rows;
    
    // Si es un objeto { "email": { metrics } }, convertir a Array
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      console.log(`[sheetService] ${label}: Detectado objeto, convirtiendo a array...`);
      return Object.entries(json).map(([key, value]: [string, any]) => ({
        correo: key,
        ...(value && typeof value === 'object' ? value : { data: value })
      }));
    }

    return [];
  } catch (err) {
    console.warn(`[sheetService] ${label} failed:`, err);
    return [];
  }
};

// ── Internal: normalise email for comparison ──────────────────────────────────
const emailOf = (raw: any): string =>
  (raw?.correo ?? raw?.Correo ?? raw?.email ?? raw?.Email ?? raw?.A ?? '')
    .toString().trim().toLowerCase();

// ══════════════════════════════════════════════════════════════════════════════
//  Public: single-agent lookup (client-side filter — no action=getAgent needed)
// ══════════════════════════════════════════════════════════════════════════════
export const getAgentData = async (email: string): Promise<AgentResponse | null> => {
  const target = email.trim().toLowerCase();
  console.log('[sheetService] getAgentData looking for:', target);

  // Fetch ALL THREE in parallel for speed
  const [mainRaw, recuperoRaw, b2xRaw] = await Promise.all([
    fetchAllFromUrl(PRIMARY_URL,  'getAgentData/primary'),
    fetchAllFromUrl(RECUPERO_URL, 'getAgentData/recupero'),
    fetchAllFromUrl(B2X_URL,      'getAgentData/b2x'),
  ]);

  // ── Search Phone ──────────────────────────────────────────────────────────
  const mainMatch = mainRaw.find(row => emailOf(row) === target);
  if (mainMatch) {
    const mapped  = mapMainAgent(mainMatch);
    const headers = Object.keys(mapped).filter(k => k !== 'correo');
    return {
      lob:        'phone',
      name:       String(mainMatch.agente ?? mainMatch.Agente ?? mainMatch.C ?? ''),
      headers,
      metrics:    headers.map(h => mapped[h as keyof typeof mapped]),
      sugerencia: mainMatch.sugerencia ?? mainMatch.Sugerencia ?? '',
      rawMetrics: mapped
    };
  }

  // ── Search Recupero ───────────────────────────────────────────────────────
  const recMatch = recuperoRaw.find(row => emailOf(row) === target);
  if (recMatch) {
    const mapped  = mapRecuperoAgent(recMatch);
    const headers = Object.keys(mapped).filter(k => k !== 'correo');
    return {
      lob:        'recupero',
      name:       String(recMatch.correo ?? recMatch.Correo ?? ''),
      headers,
      metrics:    headers.map(h => mapped[h as keyof typeof mapped]),
      sugerencia: recMatch.sugerencia ?? recMatch.Sugerencia ?? '',
      rawMetrics: mapped
    };
  }

  // ── Search B2X ────────────────────────────────────────────────────────────
  const b2xMatch = b2xRaw.find(row => emailOf(row) === target);
  if (b2xMatch) {
    const mapped  = mapB2xAgent(b2xMatch);
    const headers = Object.keys(mapped).filter(k => k !== 'correo');
    return {
      lob:        'b2x',
      name:       String(b2xMatch.agente ?? b2xMatch.Agente ?? b2xMatch.name ?? b2xMatch.B ?? ''),
      headers,
      metrics:    headers.map(h => mapped[h as keyof typeof mapped]),
      sugerencia: b2xMatch.sugerencia ?? b2xMatch.Sugerencia ?? '',
      rawMetrics: mapped
    };
  }

  console.warn('[sheetService] Agent not found in any LOB:', target);
  return null;
};

// ══════════════════════════════════════════════════════════════════════════════
//  Public: admin — fetch each source independently (separate tables)
// ══════════════════════════════════════════════════════════════════════════════

/** Phone agents mapped to the agreed columns. */
export const getMainAgents = async (): Promise<any[]> => {
  const raw = await fetchAllFromUrl(PRIMARY_URL, 'getMainAgents');
  return raw.map(mapMainAgent);
};

/** Recupero agents mapped to their columns. */
export const getRecuperoAgents = async (): Promise<any[]> => {
  const raw = await fetchAllFromUrl(RECUPERO_URL, 'getRecuperoAgents');
  return raw.map(mapRecuperoAgent);
};

/** B2X agents mapped to their columns (AHT, FRT, ACW, SAT). */
export const getB2xAgents = async (): Promise<any[]> => {
  console.log('[sheetService] Cargando métricas de B2X desde env...');
  const raw = await fetchAllFromUrl(B2X_URL, 'getB2xAgents');
  return raw.map(mapB2xAgent);
};

/** Legacy: merged list for any code that still calls getAllAgents(). */
export const getAllAgents = async (): Promise<any[]> => {
  const [m, r, b] = await Promise.all([getMainAgents(), getRecuperoAgents(), getB2xAgents()]);
  return [...m, ...r, ...b];
};

// ══════════════════════════════════════════════════════════════════════════════
//  Public: update suggestion (routes to the correct script automatically)
// ══════════════════════════════════════════════════════════════════════════════
export const updateAgentSuggestion = async (email: string, suggestion: string): Promise<any> => {
  const target = email.trim().toLowerCase();

  // Lightweight probe: check if the agent is in Recupero or B2X
  const [recAll, b2xAll] = await Promise.all([
    fetchAllFromUrl(RECUPERO_URL, 'updateProbe/recupero'),
    fetchAllFromUrl(B2X_URL,      'updateProbe/b2x'),
  ]);

  const inRecupero = recAll.some(row => emailOf(row) === target);
  const inB2x      = b2xAll.some(row => emailOf(row) === target);

  let targetUrl: string | undefined;
  if (inRecupero) targetUrl = RECUPERO_URL;
  else if (inB2x) targetUrl = B2X_URL;
  else            targetUrl = PRIMARY_URL;

  if (!targetUrl) throw new Error('[sheetService] updateAgentSuggestion: no API URL configured.');

  const res = await fetch(targetUrl, {
    method:   'POST',
    headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
    body:     JSON.stringify({ action: 'update', correo: email.trim(), sugerencia: suggestion }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};


/** @deprecated Use getAgentData() directly. */
export const findAgentLob = async (email: string) => {
  const r = await getAgentData(email);
  return r ? { lob: r.lob as any, data: r.metrics } : null;
};

// ══════════════════════════════════════════════════════════════════════════════
//  Public: History lookup
// ══════════════════════════════════════════════════════════════════════════════
export const getAgentHistory = async (email: string): Promise<AgentHistory | null> => {
  if (!HISTORICO_URL) {
    console.warn('[sheetService] getAgentHistory: VITE_HISTORICO_URL is undefined.');
    return null;
  }
  
  try {
    const target = email.trim().toLowerCase();
    const res = await fetch(`${HISTORICO_URL}?email=${target}`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log('[sheetService] getAgentHistory result:', json);
    return json as AgentHistory;
  } catch (err) {
    console.warn('[sheetService] getAgentHistory failed:', err);
    return null;
  }
};
