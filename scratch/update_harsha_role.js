const sql = require('mssql');
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function updateHarsha() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL");
        
        // Update tournament_players
        await pool.request()
            .input("pn", sql.NVarChar, "harsha")
            .input("r", sql.NVarChar, "All-Rounder")
            .query("UPDATE tournament_players SET role = @r WHERE player_name = @pn");

        // Update player_profile
        await pool.request()
            .input("pn", sql.NVarChar, "harsha")
            .input("r", sql.NVarChar, "All-Rounder")
            .query("UPDATE player_profile SET role = @r WHERE player_name = @pn");
            
        console.log("Harsha's role updated to All-Rounder in all tables");
        
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
updateHarsha();
