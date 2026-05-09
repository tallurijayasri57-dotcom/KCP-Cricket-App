const sql = require('mssql');
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function checkTables() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL");
        
        const res = await pool.request().query("SELECT name FROM sys.tables");
        console.log("Tables in DB:", res.recordset.map(r => r.name));
        
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
checkTables();
