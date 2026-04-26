const sql = require('mssql');
const config = {
    server: 'localhost\\SQLEXPRESS',
    database: 'cricket_db',
    user: 'sa',
    password: 'sadb@123',
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function fixPasswords() {
    const pool = await sql.connect(config);
    
    // Update vamsi's password to 5656
    await pool.request()
        .input('u', sql.NVarChar, 'vamsi')
        .input('p', sql.NVarChar, '5656')
        .query('UPDATE users SET password=@p WHERE username=@u');
    
    console.log('vamsi password updated to 5656!');
    
    // Show all users
    const users = await pool.request().query('SELECT id, username, password FROM users');
    console.log('\n=== ALL USERS ===');
    users.recordset.forEach(u => console.log(`ID:${u.id} | ${u.username} | ${u.password}`));
    
    process.exit(0);
}

fixPasswords().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
