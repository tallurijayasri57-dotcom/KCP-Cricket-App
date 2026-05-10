const sql = require('mssql');
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function checkMatches() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL");
        
        const res = await pool.request().query("SELECT id, team1, team2, result, status FROM tournament_matches");
        console.log("Matches in SQL:", JSON.stringify(res.recordset, null, 2));
        
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
checkMatches();
