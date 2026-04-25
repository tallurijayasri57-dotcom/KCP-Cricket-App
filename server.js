const express = require("express");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "das4ixee0",
    api_key: process.env.CLOUDINARY_API_KEY || "257379219351122",
    api_secret: process.env.CLOUDINARY_API_SECRET || "7kqK84VNi8Soby13w5ydIspW7oE"
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// ✅ SQL Server Connection Config
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123", 
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

// ✅ DB Connect Function
async function connectDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ SQL Server Connected!");
        await createTables();
    } catch (err) {
        console.error("❌ SQL Server Connection Error:", err.message);
        setTimeout(connectDB, 5000); // 5 sec తర్వాత retry
    }
}

// ✅ Tables Create చేయడం (already exists అయినా error రాదు)
async function createTables() {
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (
                id         INT IDENTITY(1,1) PRIMARY KEY,
                username   NVARCHAR(255) NOT NULL UNIQUE,
                password   NVARCHAR(255) NOT NULL,
                photo_url  NVARCHAR(500) NULL,
                created_at DATETIME DEFAULT GETDATE()
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='teams' AND xtype='U')
            CREATE TABLE teams (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                team_name NVARCHAR(255) NOT NULL
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='players' AND xtype='U')
            CREATE TABLE players (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                team_name   NVARCHAR(255) NOT NULL,
                player_name NVARCHAR(255) NOT NULL,
                role        NVARCHAR(50)  NULL,
                photo_url   NVARCHAR(500) NULL
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='match_results' AND xtype='U')
            CREATE TABLE match_results (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                winner    NVARCHAR(255) NOT NULL,
                loser     NVARCHAR(255) NOT NULL,
                win_type  NVARCHAR(100) NOT NULL,
                margin    NVARCHAR(100) NOT NULL,
                played_on NVARCHAR(50)  NOT NULL
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='upcoming_matches' AND xtype='U')
            CREATE TABLE upcoming_matches (
                id         INT IDENTITY(1,1) PRIMARY KEY,
                team1      NVARCHAR(255) NOT NULL,
                team2      NVARCHAR(255) NOT NULL,
                match_date DATE          NOT NULL,
                created_at DATETIME DEFAULT GETDATE()
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='player_stats' AND xtype='U')
            CREATE TABLE player_stats (
                id             INT IDENTITY(1,1) PRIMARY KEY,
                player_name    NVARCHAR(255) NOT NULL,
                team_name      NVARCHAR(255) NULL,
                match_date     DATE          NULL,
                match_type     NVARCHAR(10)  NULL,
                runs           INT  DEFAULT 0,
                balls_faced    INT  DEFAULT 0,
                fours          INT  DEFAULT 0,
                sixes          INT  DEFAULT 0,
                wickets        INT  DEFAULT 0,
                overs_bowled   NVARCHAR(10)  DEFAULT '0.0',
                runs_conceded  INT  DEFAULT 0,
                strike_rate    FLOAT DEFAULT 0,
                dismissal_type NVARCHAR(50)  NULL,
                dismissed_by   NVARCHAR(255) NULL,
                catches        INT  DEFAULT 0,
                run_outs       INT  DEFAULT 0,
                stumpings      INT  DEFAULT 0,
                match_id       INT  NULL,
                innings        INT  DEFAULT 1,
                shot_types     NVARCHAR(MAX) NULL,
                wagon_wheel    NVARCHAR(MAX) NULL
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='player_profile' AND xtype='U')
            CREATE TABLE player_profile (
                player_id   INT IDENTITY(1,1) PRIMARY KEY,
                player_name NVARCHAR(255) NULL,
                team_name   NVARCHAR(255) NULL,
                runs        INT DEFAULT 0,
                role        NVARCHAR(50) NULL
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='points_table' AND xtype='U')
            CREATE TABLE points_table (
                id             INT IDENTITY(1,1) PRIMARY KEY,
                team_name      NVARCHAR(255) UNIQUE,
                matches_played INT   DEFAULT 0,
                wins           INT   DEFAULT 0,
                losses         INT   DEFAULT 0,
                points         INT   DEFAULT 0,
                runs_scored    FLOAT DEFAULT 0,
                runs_conceded  FLOAT DEFAULT 0,
                overs_faced    FLOAT DEFAULT 0,
                overs_bowled   FLOAT DEFAULT 0,
                net_run_rate   FLOAT DEFAULT 0
            )
        `);

        console.log("✅ All Tables Ready!");
    } catch (err) {
        console.error("❌ Table Creation Error:", err.message);
    }
}

connectDB();

// Keep-alive ping
setInterval(async () => {
    try {
        await pool.request().query("SELECT 1");
    } catch (e) {
        console.log("DB ping failed, reconnecting...");
        connectDB();
    }
}, 5 * 60 * 1000);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/scorecard/*", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// ================= USERS =================

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const check = await pool.request()
            .input("username", sql.NVarChar, username)
            .query("SELECT * FROM users WHERE username = @username");

        if (check.recordset.length > 0) {
            return res.json({ message: "Already Registered" });
        }

        await pool.request()
            .input("username", sql.NVarChar, username)
            .input("password", sql.NVarChar, password)
            .query("INSERT INTO users (username, password) VALUES (@username, @password)");

        res.json({ message: "Registered Successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.request()
            .input("username", sql.NVarChar, username)
            .query("SELECT * FROM users WHERE username = @username");

        if (result.recordset.length === 0) {
            return res.json({ success: false, error: "invalid_username" });
        }
        if (result.recordset[0].password !== password) {
            return res.json({ success: false, error: "invalid_password" });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= TEAMS =================

app.get("/teams", async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM teams");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/teams", async (req, res) => {
    try {
        await pool.request()
            .input("name", sql.NVarChar, req.body.name)
            .query("INSERT INTO teams (team_name) VALUES (@name)");
        res.send("Team Added Successfully");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/teams/:id", async (req, res) => {
    try {
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM teams WHERE id = @id");
        res.json({ message: "Team Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/teams/name/:name", async (req, res) => {
    try {
        await pool.request()
            .input("name", sql.NVarChar, req.params.name)
            .query("DELETE FROM teams WHERE TRIM(team_name) = TRIM(@name)");
        res.json({ message: "Team Deleted by Name" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= PLAYERS =================

app.get("/players/:team", async (req, res) => {
    try {
        const result = await pool.request()
            .input("team", sql.NVarChar, req.params.team)
            .query("SELECT * FROM players WHERE team_name = @team");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/players", async (req, res) => {
    const { team_name, player_name, role } = req.body;
    try {
        await pool.request()
            .input("team_name", sql.NVarChar, team_name)
            .input("player_name", sql.NVarChar, player_name)
            .input("role", sql.NVarChar, role)
            .query("INSERT INTO players (team_name, player_name, role) VALUES (@team_name, @player_name, @role)");
        res.send("Player Added");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/players/:id", async (req, res) => {
    try {
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM players WHERE id = @id");
        res.json({ message: "Player Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/players/name/:teamName/:playerName", async (req, res) => {
    try {
        await pool.request()
            .input("teamName", sql.NVarChar, req.params.teamName)
            .input("playerName", sql.NVarChar, req.params.playerName)
            .query("DELETE FROM players WHERE TRIM(team_name) = TRIM(@teamName) AND TRIM(player_name) = TRIM(@playerName)");
        res.json({ message: "Player Deleted by Name" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= MATCH RESULTS =================

app.get("/match-results", async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT * FROM match_results ORDER BY id DESC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/match-results", async (req, res) => {
    const { winner, loser, win_type, margin, played_on } = req.body;
    try {
        const result = await pool.request()
            .input("winner", sql.NVarChar, winner)
            .input("loser", sql.NVarChar, loser)
            .input("win_type", sql.NVarChar, win_type)
            .input("margin", sql.NVarChar, margin)
            .input("played_on", sql.NVarChar, played_on)
            .query(`INSERT INTO match_results (winner, loser, win_type, margin, played_on)
                    VALUES (@winner, @loser, @win_type, @margin, @played_on);
                    SELECT SCOPE_IDENTITY() AS id`);
        res.json({ message: "Result saved", id: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/match-results/:id", async (req, res) => {
    try {
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`DELETE FROM player_stats WHERE match_id = @id;
                    DELETE FROM match_results WHERE id = @id;`);
        res.json({ message: "Match Result Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= UPCOMING MATCHES =================

app.get("/upcoming-matches", async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT * FROM upcoming_matches ORDER BY match_date ASC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/upcoming-matches", async (req, res) => {
    const { team1, team2, match_date } = req.body;
    if (!team1 || !team2 || !match_date) return res.status(400).json({ error: "Missing fields" });
    if (team1 === team2) return res.status(400).json({ error: "Same teams" });
    try {
        const result = await pool.request()
            .input("team1", sql.NVarChar, team1)
            .input("team2", sql.NVarChar, team2)
            .input("match_date", sql.Date, match_date)
            .query(`INSERT INTO upcoming_matches (team1, team2, match_date)
                    VALUES (@team1, @team2, @match_date);
                    SELECT SCOPE_IDENTITY() AS id`);
        res.json({ message: "Match scheduled", id: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/upcoming-matches/:id", async (req, res) => {
    try {
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM upcoming_matches WHERE id = @id");
        res.json({ message: "Match deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= PLAYER STATS =================

app.post("/player-stats", async (req, res) => {
    const {
        player_name, team_name, match_date, match_type,
        runs, balls_faced, fours, sixes, wickets,
        overs_bowled, runs_conceded,
        dismissal_type, dismissed_by,
        catches, run_outs, stumpings,
        match_id, innings, shot_types, wagon_wheel
    } = req.body;

    const sr = balls_faced > 0 ? parseFloat(((runs || 0) / balls_faced * 100).toFixed(2)) : 0;

    try {
        const result = await pool.request()
            .input("player_name", sql.NVarChar, player_name)
            .input("team_name", sql.NVarChar, team_name || "")
            .input("match_date", sql.Date, match_date || new Date())
            .input("match_type", sql.NVarChar, match_type)
            .input("runs", sql.Int, runs || 0)
            .input("balls_faced", sql.Int, balls_faced || 0)
            .input("fours", sql.Int, fours || 0)
            .input("sixes", sql.Int, sixes || 0)
            .input("wickets", sql.Int, wickets || 0)
            .input("overs_bowled", sql.NVarChar, overs_bowled || "0.0")
            .input("runs_conceded", sql.Int, runs_conceded || 0)
            .input("strike_rate", sql.Float, sr)
            .input("dismissal_type", sql.NVarChar, dismissal_type || null)
            .input("dismissed_by", sql.NVarChar, dismissed_by || null)
            .input("catches", sql.Int, catches || 0)
            .input("run_outs", sql.Int, run_outs || 0)
            .input("stumpings", sql.Int, stumpings || 0)
            .input("match_id", sql.Int, match_id || null)
            .input("innings", sql.Int, innings || 1)
            .input("shot_types", sql.NVarChar, shot_types || null)
            .input("wagon_wheel", sql.NVarChar, wagon_wheel || null)
            .query(`INSERT INTO player_stats
                (player_name, team_name, match_date, match_type, runs, balls_faced, fours, sixes,
                 wickets, overs_bowled, runs_conceded, strike_rate, dismissal_type, dismissed_by,
                 catches, run_outs, stumpings, match_id, innings, shot_types, wagon_wheel)
                VALUES
                (@player_name, @team_name, @match_date, @match_type, @runs, @balls_faced, @fours, @sixes,
                 @wickets, @overs_bowled, @runs_conceded, @strike_rate, @dismissal_type, @dismissed_by,
                 @catches, @run_outs, @stumpings, @match_id, @innings, @shot_types, @wagon_wheel);
                SELECT SCOPE_IDENTITY() AS id`);
        res.json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/player-stats/:playerName", async (req, res) => {
    try {
        const result = await pool.request()
            .input("player_name", sql.NVarChar, req.params.playerName)
            .query("SELECT * FROM player_stats WHERE player_name = @player_name ORDER BY match_date DESC, id DESC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/player-stats-by-match", async (req, res) => {
    const { match_id } = req.query;
    if (!match_id) return res.status(400).json({ error: "match_id required" });
    try {
        const result = await pool.request()
            .input("match_id", sql.Int, match_id)
            .query("SELECT * FROM player_stats WHERE match_id = @match_id ORDER BY id ASC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= PLAYER PROFILE =================

app.get("/player-profile", async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM player_profile");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/player-profile", async (req, res) => {
    const { player_name, team_name, runs, role } = req.body;
    try {
        const result = await pool.request()
            .input("player_name", sql.NVarChar, player_name)
            .input("team_name", sql.NVarChar, team_name || "")
            .input("runs", sql.Int, runs || 0)
            .input("role", sql.NVarChar, role || "")
            .query(`INSERT INTO player_profile (player_name, team_name, runs, role)
                    VALUES (@player_name, @team_name, @runs, @role);
                    SELECT SCOPE_IDENTITY() AS id`);
        res.json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/player-profile/:id", async (req, res) => {
    try {
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM player_profile WHERE player_id = @id");
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= POINTS TABLE =================

app.get("/points-table", async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT * FROM points_table ORDER BY points DESC, net_run_rate DESC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/points-table/update", async (req, res) => {
    const { winner, loser, winner_runs, winner_overs, loser_runs, loser_overs } = req.body;
    try {
        // Winner update
        await pool.request()
            .input("team", sql.NVarChar, winner)
            .input("wr", sql.Float, winner_runs || 0)
            .input("lr", sql.Float, loser_runs || 0)
            .input("wo", sql.Float, winner_overs || 0)
            .input("lo", sql.Float, loser_overs || 0)
            .query(`
                IF EXISTS (SELECT 1 FROM points_table WHERE team_name = @team)
                    UPDATE points_table SET
                        matches_played = matches_played + 1,
                        wins = wins + 1,
                        points = points + 2,
                        runs_scored = runs_scored + @wr,
                        runs_conceded = runs_conceded + @lr,
                        overs_faced = overs_faced + @wo,
                        overs_bowled = overs_bowled + @lo
                    WHERE team_name = @team
                ELSE
                    INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled)
                    VALUES (@team, 1, 1, 0, 2, @wr, @lr, @wo, @lo)
            `);

        // Loser update
        await pool.request()
            .input("team", sql.NVarChar, loser)
            .input("lr", sql.Float, loser_runs || 0)
            .input("wr", sql.Float, winner_runs || 0)
            .input("lo", sql.Float, loser_overs || 0)
            .input("wo", sql.Float, winner_overs || 0)
            .query(`
                IF EXISTS (SELECT 1 FROM points_table WHERE team_name = @team)
                    UPDATE points_table SET
                        matches_played = matches_played + 1,
                        losses = losses + 1,
                        runs_scored = runs_scored + @lr,
                        runs_conceded = runs_conceded + @wr,
                        overs_faced = overs_faced + @lo,
                        overs_bowled = overs_bowled + @wo
                    WHERE team_name = @team
                ELSE
                    INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled)
                    VALUES (@team, 1, 0, 1, 0, @lr, @wr, @lo, @wo)
            `);

        // NRR update
        await pool.request().query(`
            UPDATE points_table SET
                net_run_rate = CASE
                    WHEN overs_bowled > 0 AND overs_faced > 0
                    THEN ROUND((runs_scored / overs_faced) - (runs_conceded / overs_bowled), 3)
                    ELSE 0
                END
        `);

        res.json({ message: "Points updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/points-table/:teamName", async (req, res) => {
    try {
        await pool.request()
            .input("name", sql.NVarChar, req.params.teamName)
            .query("DELETE FROM points_table WHERE team_name = @name");
        res.json({ message: "Team Removed from Points Table" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= PHOTO UPLOAD =================

app.post("/upload-photo", upload.single("photo"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const player_name = req.body.player_name ? req.body.player_name.trim() : "";

    cloudinary.uploader.upload_stream(
        { folder: "kcp_players", public_id: player_name.replace(/\s+/g, "_") },
        async (error, result) => {
            if (error) return res.status(500).json({ error: error.message });
            try {
                // Check if player exists (using TRIM to be safe)
                const check = await pool.request()
                    .input("pname", sql.NVarChar, player_name)
                    .query("SELECT * FROM players WHERE TRIM(player_name) = @pname");

                if (check.recordset.length > 0) {
                    await pool.request()
                        .input("url", sql.NVarChar, result.secure_url)
                        .input("pname", sql.NVarChar, player_name)
                        .query("UPDATE players SET photo_url = @url WHERE TRIM(player_name) = @pname");
                } else {
                    // If player doesn't exist in the global players table, create them
                    await pool.request()
                        .input("url", sql.NVarChar, result.secure_url)
                        .input("pname", sql.NVarChar, player_name)
                        .input("team", sql.NVarChar, req.body.team_name || "Tournament Team")
                        .query("INSERT INTO players (player_name, team_name, photo_url, role) VALUES (@pname, @team, @url, 'Player')");
                }
                res.json({ success: true, url: result.secure_url });
            } catch (err) {
                console.error("Upload DB Error:", err.message);
                res.status(500).json({ error: err.message });
            }
        }
    ).end(req.file.buffer);
});

app.get("/player-photo/:player_name", async (req, res) => {
    try {
        const result = await pool.request()
            .input("pname", sql.NVarChar, req.params.player_name.trim())
            .query("SELECT photo_url FROM players WHERE TRIM(player_name) = @pname");
        if (result.recordset.length === 0) return res.json({ photo_url: null });
        res.json({ photo_url: result.recordset[0].photo_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= USER PHOTO =================

app.post("/user-photo", async (req, res) => {
    const { username, photo_url } = req.body;
    try {
        await pool.request()
            .input("photo_url", sql.NVarChar, photo_url)
            .input("username", sql.NVarChar, username)
            .query("UPDATE users SET photo_url = @photo_url WHERE username = @username");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/user-photo/:username", async (req, res) => {
    try {
        const result = await pool.request()
            .input("username", sql.NVarChar, req.params.username)
            .query("SELECT photo_url FROM users WHERE username = @username");
        if (result.recordset.length === 0) return res.json({ photo_url: null });
        res.json({ photo_url: result.recordset[0].photo_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= SERVER =================

app.listen(process.env.PORT || 3001, () => {
    console.log("✅ Server running on port " + (process.env.PORT || 3001));
});