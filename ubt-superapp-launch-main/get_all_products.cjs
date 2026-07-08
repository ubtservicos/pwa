const { createClient } = require('c:/Users/MacInBox/Documents/profissional/ubt-ag/site/ubt-superapp-launch-main/node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://xqujubbqcfqxkfczbidq.supabase.co';
const supabaseAnonKey = 'sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    const { data, error } = await supabase.from('produtos').select('*');
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Products:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Err:', err);
  }
}
main();
