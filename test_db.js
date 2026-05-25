const sql = require("mssql");
const config = {
    user: "sa",
    password: "sadb@123",
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    options: { encrypt: false, trustServerCertificate: true }
};

sql.connect(config).then(pool => {
    return pool.request().query("SELECT TOP 10 id, player_name, match_id FROM player_stats WHERE match_id IN ('7', '8')");
}).then(r => {
    console.log(r.recordset);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
