const fs = require('fs');

function fixSyntax(filename) {
  if (!fs.existsSync(filename)) return;
  let content = fs.readFileSync(filename, 'utf8');
  content = content.replace(/\\n\s*useEffect\(/g, '\n  useEffect(');
  fs.writeFileSync(filename, content, 'utf8');
}

fixSyntax('src/pages/AmbulantesOnboardingPage.tsx');
fixSyntax('src/pages/PrestadorMototaxiOnboarding.tsx');
fixSyntax('src/pages/CocoOnboardingPage.tsx');
console.log("Fixed syntax errors.");
