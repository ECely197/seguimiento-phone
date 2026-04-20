export const fetchAgentChats = async (spreadsheetId: string, sheetName: string, email: string, week: string, lobName: string = '') => {
  const isClaims = lobName.toLowerCase() === 'claims';

  // 1. Sanitización del Spreadsheet ID (Por si pegaron la URL completa)
  let cleanId = spreadsheetId.trim();
  if (cleanId.includes('/d/')) {
    const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      cleanId = match[1];
    }
  }
  
  let query = '';
  if (isClaims) {
      // NUEVA CONSULTA SQL (Aplica solo si lobName === 'Claims')
      // Selecciona Fecha, Contact Reason, Partner ID, Ticket, PSAT, AHT
      query = `select A, E, G, H, M, O where lower(B) = '${email.toLowerCase().trim()}' and P = ${week}`;
  } else {
      // SQL Query Original: F (Ticket), H (Fecha), P (AHT), R (WUT), S (FRT), W (PSAT) 
      query = `select F, H, P, R, S, W where lower(E) = '${email.toLowerCase().trim()}' and AC = ${week}`;
  }
  
  // 3. Construcción de la URL segura
  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=${encodeURIComponent(query)}`;
  console.log("GViz URL de consulta limpia:", url);
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // GViz response format: /*O_o*/ google.visualization.Query.setResponse({...});
    const jsonString = text.match(/(?<=.*\().*(?=\);)/s)?.[0]; 
    if (!jsonString) return [];
    
    const data = JSON.parse(jsonString);
    if (data.status === 'error') {
      console.error("GViz API Error:", data.errors);
      return [];
    }

    // Validar si data.table.rows existe para evitar fallos si la consulta no devuelve nada
    if (!data.table || !data.table.rows) return [];

    return data.table.rows.map((row: any) => {
      if (isClaims) {
          // Mapeo adaptado a: select A, E, G, H, M, O (Solo Claims)
          return {
            fecha: row.c[0]?.f || row.c[0]?.v || '',         // Columna A
            contactReason: row.c[1]?.v || '',                // Columna E
            partnerId: row.c[2]?.v?.toString() || '',        // Columna G
            ticket: row.c[3]?.v?.toString() || '',           // Columna H
            psat: row.c[4]?.f || row.c[4]?.v || '',          // Columna M
            aht: row.c[5]?.f || row.c[5]?.v || ''            // Columna O
          };
      } else {
          return {
            ticket: row.c[0]?.v || '',
            fecha: row.c[1]?.f || row.c[1]?.v || '', 
            aht: row.c[2]?.v || '',
            wut: row.c[3]?.v || '',
            frt: row.c[4]?.v || '',
            psat: row.c[5]?.f || row.c[5]?.v || '' 
          };
      }
    });
  } catch (error) {
    console.error("Error fetching from GViz", error);
    return [];
  }
};
