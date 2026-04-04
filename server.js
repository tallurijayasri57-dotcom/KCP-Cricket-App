const express = require("express");
const { Pool } = require("pg");
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

// ✅ Supabase PostgreSQL connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:9494167827Harsha@db.tododjcpqcydjnhaetlk.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

// ✅ Create all tables on startup
db.connect((err, client, release) => {
    if (err) { console.log("Supabase Connection Error:", err.message); return; }
    console.log("✅ Supabase Connected!");
    release();

    db.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(255) NOT NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        role VARCHAR(50),
        photo_url VARCHAR(500)
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS match_results (
        id SERIAL PRIMARY KEY,
        winner VARCHAR(255) NOT NULL,
        loser VARCHAR(255) NOT NULL,
        win_type VARCHAR(100) NOT NULL,
        margin VARCHAR(100) NOT NULL,
        played_on VARCHAR(50) NOT NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS upcoming_matches (
        id SERIAL PRIMARY KEY,
        team1 VARCHAR(255) NOT NULL,
        team2 VARCHAR(255) NOT NULL,
        match_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS player_stats (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        match_date DATE,
        match_type VARCHAR(10),
        runs INT DEFAULT 0,
        balls_faced INT DEFAULT 0,
        fours INT DEFAULT 0,
        sixes INT DEFAULT 0,
        wickets INT DEFAULT 0,
        overs_bowled VARCHAR(10) DEFAULT '0.0',
        runs_conceded INT DEFAULT 0,
        strike_rate FLOAT DEFAULT 0,
        dismissal_type VARCHAR(50),
        dismissed_by VARCHAR(255),
        catches INT DEFAULT 0,
        run_outs INT DEFAULT 0,
        stumpings INT DEFAULT 0,
        match_id INT,
        innings INT DEFAULT 1,
        shot_types TEXT,
        wagon_wheel TEXT
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS player_profile (
        player_id SERIAL PRIMARY KEY,
        player_name VARCHAR(255),
        team_name VARCHAR(255),
        runs INT DEFAULT 0,
        role VARCHAR(50)
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS points_table (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(255) UNIQUE,
        matches_played INT DEFAULT 0,
        wins INT DEFAULT 0,
        losses INT DEFAULT 0,
        points INT DEFAULT 0,
        runs_scored FLOAT DEFAULT 0,
        runs_conceded FLOAT DEFAULT 0,
        overs_faced FLOAT DEFAULT 0,
        overs_bowled FLOAT DEFAULT 0,
        net_run_rate FLOAT DEFAULT 0
    )`);
});

// Keep-alive
function keepAlive() {
    const https = require("https");
    https.get("https://kcp-cricket-app-b7ni.onrender.com/health", (res) => {
        console.log("Keep-alive:", res.statusCode);
    }).on("error", (err) => {
        console.log("Keep-alive failed:", err.message);
    });
}
setInterval(keepAlive, 14 * 60 * 1000);

// DB keep-alive
setInterval(() => {
    db.query("SELECT 1").catch(err => console.log("DB ping error:", err.message));
}, 5 * 60 * 1000);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// ================= USERS =================

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE username=$1", [username]);
        if (result.rows.length > 0) { return res.json({ message: "Already Registered" }); }
        await db.query("INSERT INTO users(username,password) VALUES($1,$2)", [username, password]);
        res.json({ message: "Registered Successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE username=$1", [username]);
        if (result.rows.length === 0) return res.json({ success: false, error: "invalid_username" });
        if (result.rows[0].password !== password) return res.json({ success: false, error: "invalid_password" });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= TEAMS =================

app.get("/teams", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM teams");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/teams", async (req, res) => {
    try {
        await db.query("INSERT INTO teams(team_name) VALUES($1)", [req.body.name]);
        res.send("Team Added Successfully");
    } catch (err) { res.status(500).send("Error"); }
});

app.delete("/teams/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM teams WHERE id=$1", [req.params.id]);
        res.json({ message: "Team Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= PLAYERS =================

app.get("/players/:team", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM players WHERE team_name=$1", [req.params.team]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/players", async (req, res) => {
    const { team_name, player_name, role } = req.body;
    try {
        await db.query("INSERT INTO players (team_name, player_name, role) VALUES ($1, $2, $3)", [team_name, player_name, role]);
        res.send("Player Added");
    } catch (err) { res.status(500).send("Error"); }
});

app.delete("/players/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM players WHERE id=$1", [req.params.id]);
        res.json({ message: "Player Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= MATCH RESULTS =================

app.get("/match-results", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM match_results ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/match-results", async (req, res) => {
    const { winner, loser, win_type, margin, played_on } = req.body;
    if (!winner || !loser) return res.status(400).send("Missing fields");
    try {
        const result = await db.query(
            "INSERT INTO match_results (winner, loser, win_type, margin, played_on) VALUES ($1,$2,$3,$4,$5) RETURNING id",
            [winner, loser, win_type, margin, played_on]
        );
        res.json({ message: "Result saved", id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= UPCOMING MATCHES =================

app.get("/upcoming-matches", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM upcoming_matches ORDER BY match_date ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/upcoming-matches", async (req, res) => {
    const { team1, team2, match_date } = req.body;
    if (!team1 || !team2 || !match_date) return res.status(400).json({ error: "Missing fields" });
    if (team1 === team2) return res.status(400).json({ error: "Same teams" });
    try {
        const result = await db.query(
            "INSERT INTO upcoming_matches (team1, team2, match_date) VALUES ($1, $2, $3) RETURNING id",
            [team1, team2, match_date]
        );
        res.json({ message: "Match scheduled", id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/upcoming-matches/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM upcoming_matches WHERE id=$1", [req.params.id]);
        res.json({ message: "Match deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    if (!player_name || !match_type) return res.status(400).json({ error: "player_name and match_type required" });
    const sr = balls_faced > 0 ? parseFloat(((runs || 0) / balls_faced * 100).toFixed(2)) : 0;
    try {
        const result = await db.query(
            `INSERT INTO player_stats (player_name, team_name, match_date, match_type, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, strike_rate, dismissal_type, dismissed_by, catches, run_outs, stumpings, match_id, innings, shot_types, wagon_wheel)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
            [player_name, team_name || "", match_date || new Date().toISOString().split("T")[0], match_type,
            runs || 0, balls_faced || 0, fours || 0, sixes || 0, wickets || 0,
            overs_bowled || "0.0", runs_conceded || 0, sr,
            dismissal_type || null, dismissed_by || null,
            catches || 0, run_outs || 0, stumpings || 0,
            match_id || null, innings || 1, shot_types || null, wagon_wheel || null]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/player-stats/:playerName", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM player_stats WHERE player_name=$1 ORDER BY match_date DESC, id DESC",
            [req.params.playerName]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/player-stats-by-match", async (req, res) => {
    const { match_id } = req.query;
    if (!match_id) return res.status(400).json({ error: "match_id required" });
    try {
        const result = await db.query(
            "SELECT * FROM player_stats WHERE match_id=$1 ORDER BY id ASC",
            [match_id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= PLAYER PROFILE =================

app.get("/player-profile", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM player_profile");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/player-profile", async (req, res) => {
    const { player_name, team_name, runs, role } = req.body;
    try {
        const result = await db.query(
            "INSERT INTO player_profile (player_name, team_name, runs, role) VALUES ($1,$2,$3,$4) RETURNING player_id",
            [player_name, team_name || "", runs || 0, role || ""]
        );
        res.json({ success: true, id: result.rows[0].player_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/player-profile/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM player_profile WHERE player_id=$1", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= POINTS TABLE =================

app.get("/points-table", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM points_table ORDER BY points DESC, net_run_rate DESC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/points-table/update", async (req, res) => {
    const { winner, loser, winner_runs, winner_overs, loser_runs, loser_overs } = req.body;
    try {
        // Update winner
        await db.query(`
            INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled)
            VALUES ($1, 1, 1, 0, 2, $2, $3, $4, $5)
            ON CONFLICT (team_name) DO UPDATE SET
                matches_played = points_table.matches_played + 1,
                wins = points_table.wins + 1,
                points = points_table.points + 2,
                runs_scored = points_table.runs_scored + $2,
                runs_conceded = points_table.runs_conceded + $3,
                overs_faced = points_table.overs_faced + $4,
                overs_bowled = points_table.overs_bowled + $5
        `, [winner, winner_runs || 0, loser_runs || 0, winner_overs || 0, loser_overs || 0]);

        // Update loser
        await db.query(`
            INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled)
            VALUES ($1, 1, 0, 1, 0, $2, $3, $4, $5)
            ON CONFLICT (team_name) DO UPDATE SET
                matches_played = points_table.matches_played + 1,
                losses = points_table.losses + 1,
                runs_scored = points_table.runs_scored + $2,
                runs_conceded = points_table.runs_conceded + $3,
                overs_faced = points_table.overs_faced + $4,
                overs_bowled = points_table.overs_bowled + $5
        `, [loser, loser_runs || 0, winner_runs || 0, loser_overs || 0, winner_overs || 0]);

        // Update NRR for all teams
        await db.query(`
            UPDATE points_table SET net_run_rate =
                CASE WHEN overs_bowled > 0 AND overs_faced > 0
                THEN ROUND(CAST((runs_scored / overs_faced) - (runs_conceded / overs_bowled) AS NUMERIC), 3)
                ELSE 0 END
        `);

        res.json({ message: "Points updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= PHOTO UPLOAD =================

app.post("/upload-photo", upload.single("photo"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const player_name = req.body.player_name;
    cloudinary.uploader.upload_stream(
        { folder: "kcp_players", public_id: player_name.replace(/\s+/g, "_") },
        async (error, result) => {
            if (error) return res.status(500).json({ error: error.message });
            try {
                await db.query("UPDATE players SET photo_url=$1 WHERE player_name=$2", [result.secure_url, player_name]);
                res.json({ success: true, url: result.secure_url });
            } catch (err) { res.status(500).json({ error: err.message }); }
        }
    ).end(req.file.buffer);
});

app.get("/player-photo/:player_name", async (req, res) => {
    try {
        const result = await db.query("SELECT photo_url FROM players WHERE player_name=$1", [req.params.player_name]);
        if (result.rows.length === 0) return res.json({ photo_url: null });
        res.json({ photo_url: result.rows[0].photo_url });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= SERVER =================

app.listen(process.env.PORT || 3000, () => {
    console.log("✅ Server running on port " + (process.env.PORT || 3000));
});