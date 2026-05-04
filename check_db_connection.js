const sql = require("mssql");

const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function checkConnection() {
    console.log("🔍 Checking SQL Server connection...\n");
    console.log("Config:", dbConfig);
    
    try {
        const pool = await sql.connect(dbConfig);
        console.log("✅ SQL Server Connected Successfully!\n");
        
        // Check if tables exist
        const result = await pool.request().query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'dbo'
        `);
        
        console.log("📊 Tables in database:", result.recordset.length);
        if (result.recordset.length > 0) {
            result.recordset.forEach(t => console.log("   - " + t.TABLE_NAME));
        } else {
            console.log("   ⚠️ No tables found! You need to create them.");
        }
        
        await pool.close();
    } catch (err) {
        console.error("❌ Connection Failed:", err.message);
        console.error("\nPossible solutions:");
        console.error("1. Make sure SQL Server is running");
        console.error("2. Verify SQLEXPRESS instance is installed");
        console.error("3. Check if database 'cricket_db' exists");
        console.error("4. Verify sa password is 'sadb@123'");
    }
}

checkConnection();
