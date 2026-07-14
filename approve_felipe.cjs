const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqujubbqcfqxkfczbidq.supabase.co';
const supabaseAnonKey = 'sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const felipeId = '4db6e8a4-535f-4a77-9dba-8f3861f8b4dd';

  console.log('Updating role in usuarios...');
  const { error: errU } = await supabase
    .from('usuarios')
    .update({ role: 'cocoecia-colaborador' })
    .eq('id', felipeId);

  if (errU) {
    console.error('Error updating usuarios:', errU.message);
  } else {
    console.log('usuarios updated successfully.');
  }

  console.log('Updating role in profiles...');
  const { error: errP } = await supabase
    .from('profiles')
    .update({ role: 'cocoecia-colaborador' })
    .eq('id', felipeId);

  if (errP) {
    console.error('Error updating profiles:', errP.message);
  } else {
    console.log('profiles updated successfully.');
  }

  console.log('Updating status_aprovacao in coco_caminhoes...');
  const { error: errC } = await supabase
    .from('coco_caminhoes')
    .update({ status_aprovacao: 'approved' })
    .eq('prestador_id', felipeId);

  if (errC) {
    console.error('Error updating coco_caminhoes:', errC.message);
  } else {
    console.log('coco_caminhoes updated successfully.');
  }
}

main();
