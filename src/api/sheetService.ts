// API URL provided via environment variable (Google Apps Script Web App)
const API_URL = import.meta.env.VITE_SHEETDB_URL as string;

/**
 * Fetch all agents from the Google Apps Script API.
 * The API returns a plain JSON array of row objects with column names as keys.
 * Example: [{ "Agente": "Juan", "correo": "juan@example.com", ... }]
 */
export const getAllAgents = async () => {
  try {
    const response = await fetch(API_URL, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Error fetching agents: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Datos recibidos de la API:', data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch all agents:', error);
    throw error;
  }
};

/**
 * Fetch a single agent's data by email from the Google Apps Script API.
 * Filters client-side from the full list.
 */
export const getAgentData = async (email: string) => {
  try {
    const allAgents = await getAllAgents();
    const cleanEmail = email.trim().toLowerCase();
    const agent = allAgents.find(
      (a: any) =>
        (a.correo || a.Correo || a.email || a.Email || '')
          .trim()
          .toLowerCase() === cleanEmail
    );
    if (!agent) {
      console.warn('Correo no encontrado en la base de datos:', cleanEmail);
      return [];
    }
    return [agent];
  } catch (error) {
    console.error('Failed to fetch agent data:', error);
    throw error;
  }
};

/**
 * Update the suggestion for an agent.
 * Sends a POST to the Apps Script API with the email and suggestion.
 * Your Apps Script must handle action=update.
 */
export const updateAgentSuggestion = async (email: string, suggestion: string) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        correo: email.trim(),
        sugerencia: suggestion,
      }),
    });
    if (!response.ok) {
      throw new Error(`Error updating agent: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to update agent suggestion:', error);
    throw error;
  }
};
