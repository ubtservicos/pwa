const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqujubbqcfqxkfczbidq.supabase.co';
const supabaseAnonKey = 'sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Verificando se a tabela coco_caminhoes existe...');
  const { data: dataC, error: errorC } = await supabase.from('coco_caminhoes').select('*').limit(1);
  if (errorC) {
    console.error('Erro na tabela coco_caminhoes:', errorC.message);
  } else {
    console.log('Tabela coco_caminhoes existe e está acessível. Dados:', dataC);
  }

  console.log('Verificando se a tabela coco_pontos existe...');
  const { data: dataP, error: errorP } = await supabase.from('coco_pontos').select('*').limit(1);
  if (errorP) {
    console.error('Erro na tabela coco_pontos:', errorP.message);
  } else {
    console.log('Tabela coco_pontos existe e está acessível. Dados:', dataP);
  }
}

main();
