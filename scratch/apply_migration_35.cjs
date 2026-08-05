const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'aws-1-sa-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.xqujubbqcfqxkfczbidq',
  password: 'Fog@NosRacist@s',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL.');

    // Read SQL file
    const sqlPath = path.join(__dirname, '..', '35_wiki_access_control.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying Migration 35...');

    // Run SQL
    await client.query(sql);
    console.log('Migration 35 SQL executed successfully.');

    // Verify tables
    const checkTablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'wiki_%';
    `);
    console.log('Verified created tables:');
    checkTablesRes.rows.forEach(r => console.log(`  - ${r.table_name}`));

  } catch (err) {
    console.error('Error during migration application:', err);
  } finally {
    await client.end();
  }
}

main();
