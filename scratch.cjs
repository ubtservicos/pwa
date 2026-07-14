const fs = require('fs');
const files = [
  'src/pages/ConfigIndexPage.tsx',
  'src/pages/DiaristaAgendaPage.tsx',
  'src/pages/DiaristasBuscaPage.tsx',
  'src/pages/GerenciarPage.tsx',
  'src/pages/PrestadorHome.tsx',
  'src/pages/AmbulantesOnlinePage.tsx',
  'src/pages/AmbulantesDiscoveryPage.tsx',
  'src/pages/AmbulanteCatalogPage.tsx',
  'src/pages/MototaxiTomador.tsx'
];
for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/import BottomNav from "@\/components\/app\/BottomNav";\n/g, '');
    content = content.replace(/import BottomNavLight from "@\/components\/prestador\/BottomNavLight";\n/g, '');
    content = content.replace(/<BottomNav \/>/g, '');
    content = content.replace(/<BottomNavLight \/>/g, '');
    content = content.replace(/{t\.isDark \? <BottomNav \/> : <BottomNavLight \/>}/g, '');
    fs.writeFileSync(f, content);
  }
}
console.log('done');
