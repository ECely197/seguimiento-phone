const fs = require('fs');

['src/pages/ExecutiveReportPage.tsx', 'src/pages/AdminAcwStats.tsx'].forEach(file => {
    let c = fs.readFileSync(file, 'utf8');
    if (!c.includes('import { auth')) {
       c = c.replace("import", "import { auth } from '../firebaseConfig';\nimport");
       fs.writeFileSync(file, c);
    }
});
