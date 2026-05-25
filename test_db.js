const sql = require("mssql");
const config = {
    user: "sa",
    password: "sadb@123",
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    options: { encrypt: false, trustServerCertificate: true }
};

sql.connect(config).then(pool => {
    return pool.request().query("SELECT TOP 5 id, match_id, tournament_id FROM match_results ORDER BY id DESC");
}).then(r => {
    console.log(r.recordset);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
