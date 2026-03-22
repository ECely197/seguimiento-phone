const fs = require('fs');
let proc = fs.readFileSync('src/pages/ProcessPage.tsx', 'utf8');
proc = proc.replace(
  '<p>Buscando en /artifacts/${appId}/public/data/processes...</p>',
  '<p>Buscando en /artifacts/{appId}/public/data/processes...</p>'
);
if (!proc.includes('import { appId }')) {
  proc = proc.replace("import { db, auth } from '../firebaseConfig';", "import { db, auth, appId } from '../firebaseConfig';");
}
fs.writeFileSync('src/pages/ProcessPage.tsx', proc, 'utf8');
