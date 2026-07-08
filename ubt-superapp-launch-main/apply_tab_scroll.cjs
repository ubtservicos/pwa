const fs = require('fs');

function applyTabScroll(filename) {
  if (!fs.existsSync(filename)) return;
  let content = fs.readFileSync(filename, 'utf8');

  // Add id to tabs
  content = content.replace(
    /key=\{t\}\s*onClick=\{\(\) => setActiveTab\(t\)\}/g,
    'key={t} id={`tab-${t}`} onClick={() => setActiveTab(t)}'
  );

  // Add useEffect for scrolling if not already present
  if (!content.includes('window.scrollTo({ top: 0')) {
    const scrollLogic = `
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const tabEl = document.getElementById(\`tab-\${activeTab}\`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);
`;
    // Find a good place to insert it. Usually after `const [activeTab, setActiveTab] = useState(...)`
    const activeTabMatch = content.match(/const \[activeTab, setActiveTab\] = useState[^;]+;/);
    if (activeTabMatch) {
      content = content.replace(activeTabMatch[0], activeTabMatch[0] + '\\n' + scrollLogic);
    }
  }

  fs.writeFileSync(filename, content, 'utf8');
}

applyTabScroll('src/pages/AmbulantesOnboardingPage.tsx');
applyTabScroll('src/pages/PrestadorMototaxiOnboarding.tsx');
applyTabScroll('src/pages/CocoOnboardingPage.tsx');

console.log("Applied tab scrolling to other categories.");
