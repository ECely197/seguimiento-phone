const fs = require('fs');

let quizPage = fs.readFileSync('src/pages/QuizPage.tsx', 'utf8');

quizPage = quizPage.replace(
  `} catch (err) {\n      console.error('Error fetching user data:', err);\n    }`,
  `} catch (err) {\n      console.error('Error fetching user data:', err);\n      setAccuracy(null);\n      setCompletedQuizzes(new Set());\n    }`
);

quizPage = quizPage.replace(
  `} catch (err) {\n        console.error('Error fetching quizzes:', err);\n        setLoading(false);\n      }`,
  `} catch (err) {\n        console.error('Error fetching quizzes:', err);\n        if(quizzes.length === 0) setQuizzes([]);\n        setLoading(false);\n      }`
);

fs.writeFileSync('src/pages/QuizPage.tsx', quizPage, 'utf8');

let processPage = fs.readFileSync('src/pages/ProcessPage.tsx', 'utf8');
if (!processPage.includes('setProcesses([])')) {
  processPage = processPage.replace(
    /} catch \(err\) {\n            console\.error\("Error cargando procesos:", err\);\n            setError\("No se pudieron cargar los procesos. Por favor, intenta más tarde."\);\n        }/g,
    `} catch (err) {\n            console.error("Error cargando procesos:", err);\n            setProcesses([]);\n            setError("No se pudieron cargar los procesos. Por favor, intenta más tarde.");\n        }`
  );
  fs.writeFileSync('src/pages/ProcessPage.tsx', processPage, 'utf8');
}

let acwPage = fs.readFileSync('src/pages/AcwPractice.tsx', 'utf8');
if (!acwPage.includes('setScenarios([])')) {
  acwPage = acwPage.replace(
    `} catch \(err\) {\n      console\.error\('Error loading scenarios:', err\);\n    }/g`,
    `} catch (err) {\n      console.error('Error loading scenarios:', err);\n      setScenarios([]);\n    }`
  );
  fs.writeFileSync('src/pages/AcwPractice.tsx', acwPage, 'utf8');
}

console.log('Fixed early catch blocks');
