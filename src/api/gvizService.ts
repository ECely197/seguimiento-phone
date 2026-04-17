export const fetchAgentChats = async (spreadsheetId: string, sheetName: string, email: string, week: string) => {
  // SQL Query: F (Ticket), H (Fecha), P (AHT), R (WUT), S (FRT), W (PSAT) 
  // WHERE E (Correo) = email AND AC (Semana) = week
  const query = `select F, H, P, R, S, W where lower(E) = '${email.toLowerCase().trim()}' and AC = ${week}`;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}&tq=${encodeURIComponent(query)}`;
  console.log("GViz URL de consulta:", url);
  
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

    return data.table.rows.map((row: any) => ({
      ticket: row.c[0]?.v || '',
      fecha: row.c[1]?.f || row.c[1]?.v || '', 
      aht: row.c[2]?.v || '',
      wut: row.c[3]?.v || '',
      frt: row.c[4]?.v || '',
      psat: row.c[5]?.f || row.c[5]?.v || '' 
    }));
  } catch (error) {
    console.error("Error fetching from GViz", error);
    return [];
  }
};
