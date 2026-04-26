const sql = require('mssql');
const dbConfig = {
    server: 'localhost\\SQLEXPRESS',
    database: 'cricket_db',
    user: 'sa',
    password: 'sadb@123',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function check() {
    try {
        let pool = await sql.connect(dbConfig);
        let res = await pool.request().query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('users', 'teams', 'players', 'match_results', 'player_stats')");
        console.log(JSON.stringify(res.recordset, null, 2));
        await pool.close();
    } catch (e) {
        console.error(e);
    }
}
check();
