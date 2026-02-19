const SHEETDB_URL = "https://sheetdb.io/api/v1/vk21ptanlf5i1";

export const getAgentData = async (email: string) => {
  try {
    // Sanitize email
    const cleanEmail = email.trim().toLowerCase();
    
    // Search using 'correo' and specific sheet 'Hoja 1'
    const response = await fetch(`${SHEETDB_URL}/search?correo=${encodeURIComponent(cleanEmail)}&sheet=Hoja%201`);
    
    if (!response.ok) {
      throw new Error(`Error fetching agent: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length === 0) {
        console.warn("Correo no encontrado en la base de datos:", cleanEmail);
    }
    
    // Normalize data keys strictly as requested
    const normalizedData = Array.isArray(data) ? data.map((agent: any) => ({
        ...agent,
        "Agente": agent.Agente || agent.nombre || agent.Nombre || "Desconocido",
        "AHT Real": agent["AHT Real"] || "N/A",
        "ATT": agent.ATT || "N/A",
        "ACW": agent.ACW || "N/A",
        "RES": agent.RES || agent.Resolución || agent.Resolucion || agent.res || "N/A",
        "PSAT": agent.PSAT || agent.Satisfacción || agent.Satisfaccion || agent.psat || "N/A",
        "Correo": agent.Correo || agent.Email || agent.email
    })) : [];

    return normalizedData;
  } catch (error) {
    console.error("Failed to fetch agent data:", error);
    throw error;
  }
};

export const getAllAgents = async () => {
  try {
    const response = await fetch(`${SHEETDB_URL}`);
    if (!response.ok) {
        throw new Error(`Error fetching agents: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Datos recibidos de SheetDB:', data);
    
    // Normalize data keys to handle potential column name changes in Google Sheets
    // Normalize data keys strictly to match getAgentData
    const normalizedData = Array.isArray(data) ? data.map((agent: any) => ({
        ...agent,
        "Agente": agent.Agente || agent.nombre || agent.Nombre || "Desconocido",
        "AHT Real": agent["AHT Real"] || "N/A",
        "ATT": agent.ATT || "N/A",
        "ACW": agent.ACW || "N/A",
        "RES": agent.RES || agent.Resolución || agent.Resolucion || agent.res || "N/A",
        "PSAT": agent.PSAT || agent.Satisfacción || agent.Satisfaccion || agent.psat || "N/A",
        "Correo": agent.Correo || agent.Email || agent.email
    })) : [];

    return normalizedData;
  } catch (error) {
    console.error("Failed to fetch all agents:", error);
    throw error;
  }
};

export const updateAgentSuggestion = async (email: string, suggestion: string) => {
  try {
    const cleanEmail = email.trim(); // Do not lowercase if searching, but API expects matching value. 
    // SheetDB update by column: PATCH /api/v1/{api_id}/{column}/{value}
    // We want to update the row where Correo = email
    
    const response = await fetch(`${SHEETDB_URL}/Correo/${encodeURIComponent(cleanEmail)}`, {
        method: 'PATCH',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: {
                'sugerencia': suggestion // Assuming 'sugerencia' is the column name for suggestions
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Error updating agent: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to update agent suggestion:", error);
    throw error;
  }
};
