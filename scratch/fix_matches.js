const sql = require('mssql');
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function fixMatches() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL");
        
        // Update match 8 based on user's previous screenshot
        await pool.request().query("UPDATE tournament_matches SET status='finished', result='KCP-Kings won by 10 wickets' WHERE id=8");
        
        // Update match 7 (another one in screenshot?)
        await pool.request().query("UPDATE tournament_matches SET status='finished', result='KCP-Kings won by 1 runs' WHERE id=7");
        
        console.log("Matches updated to finished");
        
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
fixMatches();
