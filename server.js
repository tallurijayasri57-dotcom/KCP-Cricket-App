const express = require("express");
const mysql = require("mysql2");
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

// FIXED: createPool — auto reconnect
const db = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// FIXED: getConnection instead of connect
db.getConnection((err, connection) => {
    if (err) { console.log("MySQL Connection Error:", err.message); return; }
    console.log("MySQL Pool Connected!");
    connection.release();

    db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_name VARCHAR(255) NOT NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_name VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NULL,
        photo_url VARCHAR(500) NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS match_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        winner VARCHAR(255) NOT NULL,
        loser VARCHAR(255) NOT NULL,
        win_type VARCHAR(100) NOT NULL,
        margin VARCHAR(100) NOT NULL,
        played_on VARCHAR(50) NOT NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS upcoming_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team1 VARCHAR(255) NOT NULL,
        team2 VARCHAR(255) NOT NULL,
        match_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS player_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
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
        player_id INT AUTO_INCREMENT PRIMARY KEY,
        player_name VARCHAR(255),
        team_name VARCHAR(255),
        runs INT DEFAULT 0,
        role VARCHAR(50)
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS points_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
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

// Keep-alive: server sleep avvakunda — every 14 min
function keepAlive() {
    const https = require("https");
    https.get("https://kcp-cricket-app-b7ni.onrender.com/health", (res) => {
        console.log("Keep-alive:", res.statusCode);
    }).on("error", (err) => {
        console.log("Keep-alive failed:", err.message);
    });
}
setInterval(keepAlive, 14 * 60 * 1000);

// DB keep-alive: MySQL drop avvakunda — every 5 min
setInterval(() => {
    db.query("SELECT 1", (err) => {
        if (err) console.log("DB ping error:", err.message);
    });
}, 5 * 60 * 1000);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// ================= USERS =================

app.post("/register", (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username=?", [username], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.length > 0) { res.json({ message: "Already Registered" }); }
        else {
            db.query("INSERT INTO users(username,password) VALUES(?,?)", [username, password], (err) => {
                if (err) return res.status(500).send(err);
                res.json({ message: "Registered Successfully" });
            });
        }
    });
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username=?", [username], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.length === 0) { return res.json({ success: false, error: "invalid_username" }); }
        if (result[0].password !== password) { return res.json({ success: false, error: "invalid_password" }); }
        res.json({ success: true });
    });
});

// ================= TEAMS =================

app.get("/teams", (req, res) => {
    db.query("SELECT * FROM teams", (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

app.post("/teams", (req, res) => {
    db.query("INSERT INTO teams(team_name) VALUES(?)", [req.body.name], (err) => {
        if (err) { console.log(err); res.send("Error"); }
        else { res.send("Team Added Successfully"); }
    });
});

app.delete("/teams/:id", (req, res) => {
    db.query("DELETE FROM teams WHERE id=?", [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Team Deleted" });
    });
});

// ================= PLAYERS =================

app.get("/players/:team", (req, res) => {
    db.query("SELECT * FROM players WHERE team_name=?", [req.params.team], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post("/players", (req, res) => {
    const { team_name, player_name, role } = req.body;
    db.query("INSERT INTO players (team_name, player_name, role) VALUES (?, ?, ?)", [team_name, player_name, role], (err) => {
        if (err) { console.log(err); res.send("Error"); }
        else { res.send("Player Added"); }
    });
});

app.delete("/players/:id", (req, res) => {
    db.query("DELETE FROM players WHERE id=?", [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Player Deleted" });
    });
});

// ================= MATCH RESULTS =================

app.get("/match-results", (req, res) => {
    db.query("SELECT * FROM match_results ORDER BY id DESC", (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post("/match-results", (req, res) => {
    const { winner, loser, win_type, margin, played_on } = req.body;
    if (!winner || !loser) return res.status(400).send("Missing fields");
    db.query("INSERT INTO match_results (winner, loser, win_type, margin, played_on) VALUES (?,?,?,?,?)",
        [winner, loser, win_type, margin, played_on],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.json({ message: "Result saved", id: result.insertId });
        }
    );
});

// ================= UPCOMING MATCHES =================

app.get("/upcoming-matches", (req, res) => {
    db.query("SELECT * FROM upcoming_matches ORDER BY match_date ASC", (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post("/upcoming-matches", (req, res) => {
    const { team1, team2, match_date } = req.body;
    if (!team1 || !team2 || !match_date) return res.status(400).json({ error: "Missing fields" });
    if (team1 === team2) return res.status(400).json({ error: "Same teams" });
    db.query("INSERT INTO upcoming_matches (team1, team2, match_date) VALUES (?, ?, ?)",
        [team1, team2, match_date],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.json({ message: "Match scheduled", id: result.insertId });
        }
    );
});

app.delete("/upcoming-matches/:id", (req, res) => {
    db.query("DELETE FROM upcoming_matches WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ message: "Match deleted" });
    });
});

// ================= PLAYER STATS =================

app.post("/player-stats", (req, res) => {
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
    db.query(
        `INSERT INTO player_stats (player_name, team_name, match_date, match_type, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, strike_rate, dismissal_type, dismissed_by, catches, run_outs, stumpings, match_id, innings, shot_types, wagon_wheel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [player_name, team_name || "", match_date || new Date().toISOString().split("T")[0], match_type,
        runs || 0, balls_faced || 0, fours || 0, sixes || 0, wickets || 0,
        overs_bowled || "0.0", runs_conceded || 0, sr,
        dismissal_type || null, dismissed_by || null,
        catches || 0, run_outs || 0, stumpings || 0,
        match_id || null, innings || 1, shot_types || null, wagon_wheel || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.insertId });
        }
    );
});

app.get("/player-stats/:playerName", (req, res) => {
    db.query("SELECT * FROM player_stats WHERE player_name = ? ORDER BY match_date DESC, id DESC",
        [req.params.playerName],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});

app.get("/player-stats-by-match", (req, res) => {
    const { match_id } = req.query;
    if (!match_id) return res.status(400).json({ error: "match_id required" });
    db.query("SELECT * FROM player_stats WHERE match_id = ? ORDER BY id ASC",
        [match_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});

// ================= PLAYER PROFILE =================

app.get("/player-profile", (req, res) => {
    db.query("SELECT * FROM player_profile", (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post("/player-profile", (req, res) => {
    const { player_name, team_name, runs, role } = req.body;
    db.query("INSERT INTO player_profile (player_name, team_name, runs, role) VALUES (?, ?, ?, ?)",
        [player_name, team_name || "", runs || 0, role || ""],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.insertId });
        }
    );
});

app.delete("/player-profile/:id", (req, res) => {
    db.query("DELETE FROM player_profile WHERE player_id=?", [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ message: "Deleted" });
    });
});

// ================= POINTS TABLE =================

app.get("/points-table", (req, res) => {
    db.query("SELECT * FROM points_table ORDER BY points DESC, net_run_rate DESC", (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post("/points-table/update", (req, res) => {
    const { winner, loser, winner_runs, winner_overs, loser_runs, loser_overs } = req.body;
    db.query(`INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled)
        VALUES (?, 1, 1, 0, 2, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE matches_played=matches_played+1, wins=wins+1, points=points+2,
        runs_scored=runs_scored+?, runs_conceded=runs_conceded+?, overs_faced=overs_faced+?, overs_bowled=overs_bowled+?`,
        [winner, winner_runs || 0, loser_runs || 0, winner_overs || 0, loser_overs || 0,
        winner_runs || 0, loser_runs || 0, winner_overs || 0, loser_overs || 0],
        (err) => {
            if (err) return res.status(500).send(err);
            db.query(`INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled)
                VALUES (?, 1, 0, 1, 0, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE matches_played=matches_played+1, losses=losses+1,
                runs_scored=runs_scored+?, runs_conceded=runs_conceded+?, overs_faced=overs_faced+?, overs_bowled=overs_bowled+?`,
                [loser, loser_runs || 0, winner_runs || 0, loser_overs || 0, winner_overs || 0,
                loser_runs || 0, winner_runs || 0, loser_overs || 0, winner_overs || 0],
                (err2) => {
                    if (err2) return res.status(500).send(err2);
                    db.query(`UPDATE points_table SET net_run_rate = CASE WHEN overs_bowled > 0 AND overs_faced > 0 THEN ROUND((runs_scored / overs_faced) - (runs_conceded / overs_bowled), 3) ELSE 0 END`);
                    res.json({ message: "Points updated" });
                });
        });
});

// ================= PHOTO UPLOAD =================

app.post("/upload-photo", upload.single("photo"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const player_name = req.body.player_name;
    cloudinary.uploader.upload_stream(
        { folder: "kcp_players", public_id: player_name.replace(/\s+/g, "_") },
        (error, result) => {
            if (error) return res.status(500).json({ error: error.message });
            db.query("UPDATE players SET photo_url=? WHERE player_name=?", [result.secure_url, player_name], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, url: result.secure_url });
            });
        }
    ).end(req.file.buffer);
});

app.get("/player-photo/:player_name", (req, res) => {
    db.query("SELECT photo_url FROM players WHERE player_name=?", [req.params.player_name], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.json({ photo_url: null });
        res.json({ photo_url: result[0].photo_url });
    });
});

// ================= SERVER =================

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running on port " + (process.env.PORT || 3000));
});
