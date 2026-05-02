const sql = require("mssql");

const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "master", // Start with master to create the DB
    user: "sa",
    password: "sadb@123",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function init() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log("Connected to SQL Server");

        // 1. Create Database if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'cricket_db')
            BEGIN
                CREATE DATABASE cricket_db;
            END
        `);
        console.log("Database 'cricket_db' verified/created");
        await pool.close();

        // 2. Connect to cricket_db to create tables
        dbConfig.database = "cricket_db";
        pool = await sql.connect(dbConfig);
        console.log("Connected to 'cricket_db'");

        const tables = [
            `CREATE TABLE users (id INT PRIMARY KEY IDENTITY(1,1), username NVARCHAR(100) NOT NULL UNIQUE, password NVARCHAR(255) NOT NULL)`,
            `CREATE TABLE teams (id INT PRIMARY KEY IDENTITY(1,1), team_name NVARCHAR(100) NOT NULL)`,
            `CREATE TABLE players (id INT PRIMARY KEY IDENTITY(1,1), team_name NVARCHAR(100), player_name NVARCHAR(100), role NVARCHAR(50), photo_url NVARCHAR(MAX))`,
            `CREATE TABLE match_results (id INT PRIMARY KEY IDENTITY(1,1), winner NVARCHAR(100), loser NVARCHAR(100), win_type NVARCHAR(50), margin NVARCHAR(100), played_on NVARCHAR(50))`,
            `CREATE TABLE upcoming_matches (id INT PRIMARY KEY IDENTITY(1,1), team1 NVARCHAR(100), team2 NVARCHAR(100), match_date DATE)`,
            `CREATE TABLE tournaments (id INT PRIMARY KEY IDENTITY(1,1), user_id NVARCHAR(100), tournament_data NVARCHAR(MAX))`,
            `CREATE TABLE live_matches (match_id NVARCHAR(100) PRIMARY KEY, match_state NVARCHAR(MAX), updated_at DATETIME DEFAULT GETDATE())`,
            `CREATE TABLE player_profile (player_id INT PRIMARY KEY IDENTITY(1,1), player_name NVARCHAR(100), team_name NVARCHAR(100), runs INT DEFAULT 0, role NVARCHAR(50))`,
            `CREATE TABLE points_table (team_name NVARCHAR(100) PRIMARY KEY, matches_played INT DEFAULT 0, wins INT DEFAULT 0, losses INT DEFAULT 0, points INT DEFAULT 0, runs_scored FLOAT DEFAULT 0, runs_conceded FLOAT DEFAULT 0, overs_faced FLOAT DEFAULT 0, overs_bowled FLOAT DEFAULT 0, net_run_rate FLOAT DEFAULT 0)`,
            `CREATE TABLE player_stats (id INT PRIMARY KEY IDENTITY(1,1), player_name NVARCHAR(100), team_name NVARCHAR(100), match_date DATE, match_type NVARCHAR(50), runs INT DEFAULT 0, balls_faced INT DEFAULT 0, fours INT DEFAULT 0, sixes INT DEFAULT 0, wickets INT DEFAULT 0, overs_bowled NVARCHAR(20), runs_conceded INT DEFAULT 0, strike_rate FLOAT DEFAULT 0, dismissal_type NVARCHAR(100), dismissed_by NVARCHAR(100), catches INT DEFAULT 0, run_outs INT DEFAULT 0, stumpings INT DEFAULT 0, match_id INT, innings INT DEFAULT 1, shot_types NVARCHAR(MAX), wagon_wheel NVARCHAR(MAX))`
        ];

        for (let tableQuery of tables) {
            let tableName = tableQuery.match(/CREATE TABLE (\w+)/)[1];
            try {
                await pool.request().query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='${tableName}' AND xtype='U') ${tableQuery}`);
                console.log(`Table '${tableName}' verified/created`);
            } catch (e) {
                console.error(`Error creating table ${tableName}:`, e.message);
            }
        }

        console.log("✅ Database Initialization Complete!");
        await pool.close();
    } catch (err) {
        console.error("❌ Initialization Failed:", err.message);
    }
}

init();
