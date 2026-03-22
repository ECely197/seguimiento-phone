const fs = require('fs');

function updateFile(file, replacer) {
  let c = fs.readFileSync(file, 'utf8');
  let original = c;
  c = replacer(c);
  if (c !== original) {
    fs.writeFileSync(file, c, 'utf8');
    console.log('Updated', file);
  }
}

['src/pages/ExecutiveReportPage.tsx', 'src/pages/AdminAcwStats.tsx'].forEach(file => {
    updateFile(file, c => {
        if (!c.includes('const user = auth.currentUser;')) {
            c = c.replace(/export default function (\w+)\(\) \{/, "export default function $1() {\n  const user = auth.currentUser;\n");
        }
        c = c.replace(/useEffect\(\(\) => \{\n\s+([A-Za-z0-9_]+)\(\);\n\s+\}, \[\]\);/g, "useEffect(() => {\n    if (!user) return;\n    $1();\n  }, [user]);");
        c = c.replace(/useEffect\(\(\) => \{\n\s+const (\w+) = async \(\) => \{\n(.*?)(\n\s+)?\}\n\s+init\(\);\n\s+\}, \[\]\);/gs, "useEffect(() => {\n    if (!user) return;\n    const $1 = async () => {\n$2$3}\n    $1();\n  }, [user]);");
        
        // ExecutiveReportPage doesn't have an extracted function
        c = c.replace(
            /useEffect\(\(\) => \{\n\s+const loadDashboard = async \(\) => \{/s,
            "useEffect(() => {\n    if (!user) return;\n    const loadDashboard = async () => {"
        );
        c = c.replace(
            /loadDashboard\(\);\n\s+\}, \[\]\);/s,
            "loadDashboard();\n  }, [user]);"
        );
        return c;
    });
});
