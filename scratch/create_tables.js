const sql = require("mssql");
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function createTable() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL Server");

        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='upcoming_matches' AND xtype='U')
            BEGIN
                CREATE TABLE upcoming_matches (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    team1 NVARCHAR(100),
                    team2 NVARCHAR(100),
                    match_date DATE,
                    match_time NVARCHAR(50)
                )
                console.log("Table 'upcoming_matches' created");
            END
            ELSE
            BEGIN
                console.log("Table 'upcoming_matches' already exists");
            END
        `;
        // Fixed the query to be valid SQL
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='upcoming_matches' AND xtype='U')
            BEGIN
                CREATE TABLE upcoming_matches (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    team1 NVARCHAR(100),
                    team2 NVARCHAR(100),
                    match_date DATE,
                    match_time NVARCHAR(50)
                )
            END
        `);
        console.log("Table upcoming_matches verified/created");
        
        // Also check tournament_matches and tournament_teams just in case
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tournament_matches' AND xtype='U')
            BEGIN
                CREATE TABLE tournament_matches (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    tournament_id INT,
                    team1_name NVARCHAR(100),
                    team2_name NVARCHAR(100),
                    match_date DATE,
                    match_time NVARCHAR(50),
                    status NVARCHAR(50) DEFAULT 'upcoming',
                    liveMatchId NVARCHAR(100)
                )
            END
            
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tournament_teams' AND xtype='U')
            BEGIN
                CREATE TABLE tournament_teams (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    tournament_id INT,
                    team_name NVARCHAR(100),
                    city NVARCHAR(100),
                    logo NVARCHAR(MAX),
                    captain NVARCHAR(100)
                )
            END
            
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tournament_players' AND xtype='U')
            BEGIN
                CREATE TABLE tournament_players (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    tournament_id INT,
                    team_name NVARCHAR(100),
                    player_name NVARCHAR(100),
                    role NVARCHAR(50),
                    photo_url NVARCHAR(MAX)
                )
            END
        `);
        console.log("Tournament tables verified/created");

        await pool.close();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

createTable();
