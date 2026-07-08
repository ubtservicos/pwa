const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqujubbqcfqxkfczbidq.supabase.co';
const supabaseAnonKey = 'sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const textPath = 'C:\\Users\\MacInBox\\.gemini\\antigravity\\brain\\8cbad69a-1539-43ca-bf05-6bad0559f4c2\\scratch\\pdf_text.txt';

const TYPE_MAP = {
  'r': 'Rua',
  'av': 'Avenida',
  'tv': 'Travessa',
  'al': 'Alameda',
  'est': 'Estrada',
  'pç': 'Praça',
  'ac': 'Acesso',
  'vla': 'Vila',
  'est mun': 'Estrada Municipal',
  'q': 'Quadra',
  'prl': 'Prolongamento',
  'rod': 'Rodovia',
  'a': 'Área',
  'ver': 'Vereda',
  'psg': 'Passagem',
  'acamp': 'Acampamento'
};

const BAIRRO_MAP = {
  'A R Picinguaba': 'Área Rural de Picinguaba',
  'A R Ubatuba': 'Área Rural de Ubatuba',
  'B Lagoa': 'Barra da Lagoa',
  'B Seca': 'Barra Seca',
  'B Vista': 'Bela Vista',
  'D Dias': 'Domingas Dias',
  'F Seca': 'Folha Seca',
  'H Florestal': 'Horto Florestal',
  'Jd Ubatuba': 'Jardim Ubatuba',
  'M Dentro': 'Mato Dentro',
  'Mte Valério': 'Monte Valério',
  'P Açu': 'Perequê Açu',
  'Pr Dura': 'Praia Dura',
  'Pr Grande': 'Praia Grande',
  'Pr P Mirim': 'Praia do Perequê Mirim',
  'Pr Puruba': 'Praia do Puruba',
  'Pr Vermelha': 'Praia Vermelha',
  'Pta Grossa': 'Ponta Grossa',
  'R Escuro': 'Rio Escuro',
  'R Prata': 'Rio da Prata',
  'S Meio': 'Sertão do Meio',
  'S P Mirim': 'Sertão do Perequê Mirim',
  'S Quina': 'Sertão da Quina',
  'S Ribeira': 'Saco da Ribeira',
  'Sta Rita': 'Santa Rita'
};

function formatLogradouro(name, typeAbbr) {
  const typeFull = TYPE_MAP[typeAbbr] || typeAbbr;
  if (name.toLowerCase().startsWith(typeFull.toLowerCase())) {
    return name;
  }
  return `${typeFull} ${name}`;
}

async function main() {
  console.log('Reading raw PDF text...');
  const content = fs.readFileSync(textPath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  let inLogradouros = false;
  const parsed = [];
  let currentItem = null;
  
  const IGNORE_PATTERNS = [
    /^\s*$/,
    /^-- \d+ of \d+ --$/,
    /^SP – Ubatuba Logradouros$/,
    /^\d+$/,
    /^Ubatuba$/
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!inLogradouros) {
      if (line === 'Logradouros') inLogradouros = true;
      continue;
    }
    if (IGNORE_PATTERNS.some(p => p.test(line))) continue;
    const cepMatch = line.match(/^(\d{5}-\d{3})\s+(.*)$/);
    if (cepMatch) {
      if (currentItem) parsed.push(currentItem);
      currentItem = { cep: cepMatch[1], rawText: cepMatch[2] };
    } else {
      if (line.includes('Veja pelo nome seguinte')) continue;
      if (currentItem) {
        currentItem.rawText += ' ' + line;
      }
    }
  }
  if (currentItem) parsed.push(currentItem);
  
  console.log(`Parsed ${parsed.length} raw items. Formatting and uploading...`);
  
  const records = parsed.map(item => {
    const parts = item.rawText.split(' - ');
    const streetName = parts[0].trim();
    const typeAbbr = parts[1].trim();
    const bairroAbbr = parts[2].trim();
    
    const logradouro = formatLogradouro(streetName, typeAbbr);
    const bairro = BAIRRO_MAP[bairroAbbr] || bairroAbbr;
    
    return {
      cep: item.cep,
      logradouro,
      bairro
    };
  });
  
  // Insert in batches of 100 to avoid payload limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    console.log(`Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)} (${batch.length} items)...`);
    
    const { error } = await supabase.from('ceps_ubatuba').upsert(batch, { onConflict: 'cep' });
    if (error) {
      console.error('Error inserting batch:', error.message);
      process.exit(1);
    }
  }
  
  console.log('Seeding completed successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
