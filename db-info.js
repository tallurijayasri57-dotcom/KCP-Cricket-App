const sql = require("mssql");

const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123", 
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function showInfo() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log("========================================");
        console.log("  DATABASE CONNECTION INFO");
        console.log("========================================");
        console.log("Server    : localhost\\SQLEXPRESS");
        console.log("Database  : kcp_cricket");
        console.log("User      : sa");
        console.log("Port      : 1433");
        console.log("========================================\n");

        const tables = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        `);
        
        console.log("Tables in this database:");
        tables.recordset.forEach((row, i) => {
            console.log(`  ${i+1}. ${row.TABLE_NAME}`);
        });

        await pool.close();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

showInfo();

