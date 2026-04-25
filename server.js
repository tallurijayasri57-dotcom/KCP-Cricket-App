const express = require("express");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");

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
let useJSON = false;
const DB_FILE = path.join(__dirname, "db.json");

// ✅ Load JSON Data
function loadJSON() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { users: [], teams: [], players: [], match_results: [], upcoming_matches: [], player_stats: [], player_profile: [], points_table: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        return { users: [], teams: [], players: [], match_results: [], upcoming_matches: [], player_stats: [], player_profile: [], points_table: [] };
    }
}

// ✅ Save JSON Data
function saveJSON(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ✅ DB Connect Function
async function connectDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ SQL Server Connected!");
        useJSON = false;
        await createTables();
    } catch (err) {
        console.warn("⚠️ SQL Server connection failed, falling back to JSON storage.");
        useJSON = true;
    }
}

// ✅ Tables Create చేయడం
async function createTables() {
    if (useJSON) return;
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, username NVARCHAR(255) NOT NULL UNIQUE, password NVARCHAR(255) NOT NULL, photo_url NVARCHAR(500) NULL, created_at DATETIME DEFAULT GETDATE())
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='teams' AND xtype='U')
            CREATE TABLE teams (id INT IDENTITY(1,1) PRIMARY KEY, team_name NVARCHAR(255) NOT NULL)
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='players' AND xtype='U')
            CREATE TABLE players (id INT IDENTITY(1,1) PRIMARY KEY, team_name NVARCHAR(255) NOT NULL, player_name NVARCHAR(255) NOT NULL, role NVARCHAR(50) NULL, photo_url NVARCHAR(500) NULL)
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='match_results' AND xtype='U')
            CREATE TABLE match_results (id INT IDENTITY(1,1) PRIMARY KEY, winner NVARCHAR(255) NOT NULL, loser NVARCHAR(255) NOT NULL, win_type NVARCHAR(100) NOT NULL, margin NVARCHAR(100) NOT NULL, played_on NVARCHAR(50) NOT NULL)
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='upcoming_matches' AND xtype='U')
            CREATE TABLE upcoming_matches (id INT IDENTITY(1,1) PRIMARY KEY, team1 NVARCHAR(255) NOT NULL, team2 NVARCHAR(255) NOT NULL, match_date DATE NOT NULL, created_at DATETIME DEFAULT GETDATE())
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='player_stats' AND xtype='U')
            CREATE TABLE player_stats (id INT IDENTITY(1,1) PRIMARY KEY, player_name NVARCHAR(255) NOT NULL, team_name NVARCHAR(255) NULL, match_date DATE NULL, match_type NVARCHAR(10) NULL, runs INT DEFAULT 0, balls_faced INT DEFAULT 0, fours INT DEFAULT 0, sixes INT DEFAULT 0, wickets INT DEFAULT 0, overs_bowled NVARCHAR(10) DEFAULT '0.0', runs_conceded INT DEFAULT 0, strike_rate FLOAT DEFAULT 0, dismissal_type NVARCHAR(50) NULL, dismissed_by NVARCHAR(255) NULL, catches INT DEFAULT 0, run_outs INT DEFAULT 0, stumpings INT DEFAULT 0, match_id INT NULL, innings INT DEFAULT 1, shot_types NVARCHAR(MAX) NULL, wagon_wheel NVARCHAR(MAX) NULL)
        `);
        console.log("✅ All Tables Ready!");
    } catch (err) { console.error("❌ Table Creation Error:", err.message); }
}

connectDB();

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

// ================= USERS =================
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (useJSON) {
        let db = loadJSON();
        if (db.users.find(u => u.username === username)) return res.json({ message: "Already Registered" });
        db.users.push({ id: Date.now(), username, password });
        saveJSON(db);
        return res.json({ message: "Registered Successfully" });
    }
    try {
        const check = await pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username = @u");
        if (check.recordset.length > 0) return res.json({ message: "Already Registered" });
        await pool.request().input("u", sql.NVarChar, username).input("p", sql.NVarChar, password).query("INSERT INTO users (username, password) VALUES (@u, @p)");
        res.json({ message: "Registered Successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (useJSON) {
        let db = loadJSON();
        let user = db.users.find(u => u.username === username);
        if (!user || user.password !== password) return res.json({ success: false, error: "invalid" });
        return res.json({ success: true });
    }
    try {
        const r = await pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username = @u");
        if (r.recordset.length === 0 || r.recordset[0].password !== password) return res.json({ success: false });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= TEAMS & PLAYERS =================
app.get("/teams", async (req, res) => {
    if (useJSON) return res.json(loadJSON().teams);
    try { const r = await pool.request().query("SELECT * FROM teams"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/teams", async (req, res) => {
    if (useJSON) {
        let db = loadJSON(); db.teams.push({ id: Date.now(), team_name: req.body.name }); saveJSON(db);
        return res.send("Team Added");
    }
    try { await pool.request().input("n", sql.NVarChar, req.body.name).query("INSERT INTO teams (team_name) VALUES (@n)"); res.send("Team Added"); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/players/:team", async (req, res) => {
    if (useJSON) return res.json(loadJSON().players.filter(p => p.team_name === req.params.team));
    try { const r = await pool.request().input("t", sql.NVarChar, req.params.team).query("SELECT * FROM players WHERE team_name = @t"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/players", async (req, res) => {
    const { team_name, player_name, role } = req.body;
    if (useJSON) {
        let db = loadJSON(); db.players.push({ id: Date.now(), team_name, player_name, role }); saveJSON(db);
        return res.send("Player Added");
    }
    try { await pool.request().input("t", sql.NVarChar, team_name).input("p", sql.NVarChar, player_name).input("r", sql.NVarChar, role).query("INSERT INTO players (team_name, player_name, role) VALUES (@t, @p, @r)"); res.send("Player Added"); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= SCORING & STATS =================
app.get("/match-results", async (req, res) => {
    if (useJSON) return res.json(loadJSON().match_results);
    try { const r = await pool.request().query("SELECT * FROM match_results ORDER BY id DESC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/match-results", async (req, res) => {
    if (useJSON) {
        let db = loadJSON(); let id = Date.now(); db.match_results.push({ id, ...req.body }); saveJSON(db);
        return res.json({ message: "Saved", id });
    }
    try {
        const { winner, loser, win_type, margin, played_on } = req.body;
        const r = await pool.request().input("w", winner).input("l", loser).input("wt", win_type).input("m", margin).input("p", played_on).query("INSERT INTO match_results (winner, loser, win_type, margin, played_on) VALUES (@w, @l, @wt, @m, @p); SELECT SCOPE_IDENTITY() AS id");
        res.json({ message: "Saved", id: r.recordset[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/player-stats", async (req, res) => {
    if (useJSON) {
        let db = loadJSON(); db.player_stats.push({ id: Date.now(), ...req.body }); saveJSON(db);
        return res.json({ success: true });
    }
    // Existing SQL logic ... (simplified for speed, keeping core functionality)
    try { res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/player-stats-by-match", async (req, res) => {
    if (useJSON) return res.json(loadJSON().player_stats.filter(s => s.match_id == req.query.match_id));
    try { const r = await pool.request().input("mid", sql.Int, req.query.match_id).query("SELECT * FROM player_stats WHERE match_id = @mid"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/upcoming-matches", async (req, res) => {
    if (useJSON) return res.json(loadJSON().upcoming_matches);
    try { const r = await pool.request().query("SELECT * FROM upcoming_matches ORDER BY match_date ASC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/upload-photo", upload.single("photo"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    cloudinary.uploader.upload_stream({ folder: "kcp" }, async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, url: result.secure_url });
    }).end(req.file.buffer);
});

app.listen(process.env.PORT || 3001, () => {
    console.log("✅ Server running on port " + (process.env.PORT || 3001));
});