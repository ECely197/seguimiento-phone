const fs = require('fs');

// 1. firebasePaths.ts
let p = fs.readFileSync('src/firebasePaths.ts', 'utf8');
p = p.replace(/collectionGroup\(db, collectionName\);/s, '');
fs.writeFileSync('src/firebasePaths.ts', p, 'utf8');

// 2. AdminAcwStats.tsx
let s = fs.readFileSync('src/pages/AdminAcwStats.tsx', 'utf8');
s = s.replace(
  /const q = query\(fetchAllUsersSubcollection\('acw_attempts'\), orderBy\('timestamp', 'desc'\)\);\s*const snap = await getDocs\(q\);\s*setAttempts\(snap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as AcwAttempt\)\)\);/s,
  `const allData = await fetchAllUsersSubcollection('acw_attempts');\n        let sorted = allData.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));\n        setAttempts(sorted as unknown as AcwAttempt[]);`
);
fs.writeFileSync('src/pages/AdminAcwStats.tsx', s, 'utf8');
