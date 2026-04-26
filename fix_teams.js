const sql = require('mssql');
const config = {
    server: 'localhost\\SQLEXPRESS',
    database: 'cricket_db',
    user: 'sa',
    password: 'sadb@123',
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function fixTeams() {
    const pool = await sql.connect(config);
    
    // Remove test entry
    await pool.request().query("DELETE FROM teams WHERE team_name = 'KCP Stars TEST'");
    
    // Add KCP Stars if not already there
    const check = await pool.request().query("SELECT * FROM teams WHERE team_name = 'KCP Stars'");
    if (check.recordset.length === 0) {
        await pool.request().query("INSERT INTO teams (team_name) VALUES ('KCP Stars')");
        console.log('KCP Stars added!');
    } else {
        console.log('KCP Stars already exists!');
    }
    
    // Show all teams and users
    const teams = await pool.request().query('SELECT * FROM teams ORDER BY id');
    const users = await pool.request().query('SELECT id, username, created_at FROM users');
    
    console.log('\n=== TEAMS IN SSMS ===');
    teams.recordset.forEach(t => console.log(t.id, t.team_name));
    
    console.log('\n=== USERS IN SSMS ===');
    users.recordset.forEach(u => console.log(u.id, u.username));
    
    process.exit(0);
}

fixTeams().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
