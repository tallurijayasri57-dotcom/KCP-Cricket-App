const sql = require('mssql');
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function updateSchema() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL");
        
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('match_results') AND name = 'organiser')
            BEGIN
                ALTER TABLE match_results ADD organiser NVARCHAR(100);
            END
        `);
        console.log("Column 'organiser' verified/added to match_results");
        
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
updateSchema();
