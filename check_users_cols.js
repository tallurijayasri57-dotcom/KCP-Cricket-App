const sql = require('mssql');
async function run() {
    const pool = await sql.connect({
        server: 'localhost\\SQLEXPRESS',
        database: 'cricket_db',
        user: 'sa',
        password: 'sadb@123',
        options: { encrypt: false, trustServerCertificate: true }
    });
    const r = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users'");
    console.log(r.recordset);
    pool.close();
}
run();
