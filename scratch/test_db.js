const sql = require("mssql");
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function test() {
    try {
        console.log("Connecting...");
        const pool = await sql.connect(dbConfig);
        console.log("Connected!");
        const r = await pool.request().query("SELECT TOP 1 * FROM users");
        console.log("Query success!", r.recordset);
        await pool.close();
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
