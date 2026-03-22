const fs = require('fs');
['src/pages/AdminUsers.tsx', 'src/pages/AdminQuizAssigner.tsx', 'src/pages/AdminProcessUpload.tsx'].forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/import \{.*?\} from ['\"]\.\.\/firebaseConfig['\"];/, match => {
    if(!match.includes('envAppId')) return match.replace('{', '{ envAppId,');
    return match;
  });
  fs.writeFileSync(file, c);
});
