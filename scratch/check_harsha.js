const sql = require('mssql');
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function checkHarsha() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL");
        
        const res = await pool.request()
            .input("pn", sql.NVarChar, "harsha")
            .query("SELECT player_name, team_name, role FROM tournament_players WHERE player_name = @pn");
        console.log("Tournament Players:", JSON.stringify(res.recordset, null, 2));

        const res2 = await pool.request()
            .input("pn", sql.NVarChar, "harsha")
            .query("SELECT player_name, team_name, role FROM players WHERE player_name = @pn");
        console.log("Regular Players:", JSON.stringify(res2.recordset, null, 2));
        
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
checkHarsha();
