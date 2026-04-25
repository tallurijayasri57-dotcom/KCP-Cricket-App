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

// ✅ SQL Server Config
const dbConfig = {
    server: "localhost\\SQLEXPRESS",
    database: "cricket_db",
    user: "sa",
    password: "sadb@123", 
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let pool = null;
let useJSON = (process.env.RENDER === "true" || !process.env.COMPUTERNAME);
const DB_FILE = path.join(__dirname, "db.json");
const INITIAL_DB = { users: [], teams: [], players: [], match_results: [], upcoming_matches: [], player_stats: [], player_profile: [], points_table: [] };

function loadJSON() {
    try {
        if (!fs.existsSync(DB_FILE)) { fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB)); return INITIAL_DB; }
        const data = fs.readFileSync(DB_FILE, "utf8");
        return data ? JSON.parse(data) : INITIAL_DB;
    } catch (e) { return INITIAL_DB; }
}

function saveJSON(data) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.error("Save Error", e); }
}

async function connectDB() {
    if (useJSON) return console.log("☁️ JSON Mode Active (Render)");
    try { 
        pool = await sql.connect(dbConfig); 
        console.log("✅ SQL Connected"); 
        await createTables();
    } catch (e) { 
        console.warn("⚠️ SQL Failed, using JSON"); 
        useJSON = true; 
    }
}

async function createTables() {
    if (!pool) return;
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, username NVARCHAR(255) NOT NULL UNIQUE, password NVARCHAR(255) NOT NULL, photo_url NVARCHAR(500) NULL, created_at DATETIME DEFAULT GETDATE())
            -- (Add other table creation queries here if needed, but keeping it brief for speed)
        `);
    } catch (e) { console.error("Table Error", e); }
}

connectDB();

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// --- REUSABLE API HANDLER ---
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (useJSON || !pool) {
        let db = loadJSON();
        if (db.users.find(u => u.username === username)) return res.json({ message: "Already Registered" });
        db.users.push({ id: Date.now(), username, password }); saveJSON(db);
        return res.json({ message: "Registered Successfully" });
    }
    try {
        const check = await pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username=@u");
        if (check.recordset.length > 0) return res.json({ message: "Already Registered" });
        await pool.request().input("u", sql.NVarChar, username).input("p", sql.NVarChar, password).query("INSERT INTO users (username,password) VALUES (@u,@p)");
        res.json({ message: "Registered Successfully" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (useJSON || !pool) {
        let db = loadJSON(); let user = db.users.find(u => u.username === username);
        if (user && user.password === password) return res.json({ success: true });
        return res.json({ success: false });
    }
    try {
        const r = await pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username=@u");
        if (r.recordset.length > 0 && r.recordset[0].password === password) return res.json({ success: true });
        res.json({ success: false });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/teams", async (req, res) => {
    if (useJSON || !pool) return res.json(loadJSON().teams);
    try { const r = await pool.request().query("SELECT * FROM teams"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/teams", async (req, res) => {
    if (useJSON || !pool) {
        let db = loadJSON(); db.teams.push({ id: Date.now(), team_name: req.body.name }); saveJSON(db);
        return res.send("Team Added");
    }
    try { await pool.request().input("n", sql.NVarChar, req.body.name).query("INSERT INTO teams (team_name) VALUES (@n)"); res.send("Team Added"); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/players/:team", async (req, res) => {
    if (useJSON || !pool) return res.json(loadJSON().players.filter(p => p.team_name === req.params.team));
    try { const r = await pool.request().input("t", sql.NVarChar, req.params.team).query("SELECT * FROM players WHERE team_name=@t"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/players", async (req, res) => {
    const { team_name, player_name, role } = req.body;
    if (useJSON || !pool) {
        let db = loadJSON(); db.players.push({ id: Date.now(), team_name, player_name, role }); saveJSON(db);
        return res.send("Player Added");
    }
    try { await pool.request().input("t", sql.NVarChar, team_name).input("p", sql.NVarChar, player_name).input("r", sql.NVarChar, role).query("INSERT INTO players (team_name, player_name, role) VALUES (@t,@p,@r)"); res.send("Player Added"); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/match-results", async (req, res) => {
    if (useJSON || !pool) return res.json(loadJSON().match_results);
    try { const r = await pool.request().query("SELECT * FROM match_results ORDER BY id DESC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/match-results", async (req, res) => {
    if (useJSON || !pool) {
        let db = loadJSON(); let id = Date.now(); db.match_results.push({ id, ...req.body }); saveJSON(db);
        return res.json({ id });
    }
    try {
        const { winner, loser, win_type, margin, played_on } = req.body;
        const r = await pool.request().input("w", winner).input("l", loser).input("wt", win_type).input("m", margin).input("p", played_on).query("INSERT INTO match_results (winner, loser, win_type, margin, played_on) VALUES (@w,@l,@wt,@m,@p); SELECT SCOPE_IDENTITY() AS id");
        res.json({ id: r.recordset[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/upcoming-matches", async (req, res) => {
    if (useJSON || !pool) return res.json(loadJSON().upcoming_matches);
    try { const r = await pool.request().query("SELECT * FROM upcoming_matches ORDER BY match_date ASC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/upcoming-matches", async (req, res) => {
    if (useJSON || !pool) {
        let db = loadJSON(); let id = Date.now(); db.upcoming_matches.push({ id, ...req.body }); saveJSON(db);
        return res.json({ id });
    }
    try {
        const { team1, team2, match_date } = req.body;
        const r = await pool.request().input("t1", team1).input("t2", team2).input("d", match_date).query("INSERT INTO upcoming_matches (team1, team2, match_date) VALUES (@t1,@t2,@d); SELECT SCOPE_IDENTITY() AS id");
        res.json({ id: r.recordset[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/points-table", async (req, res) => {
    if (useJSON || !pool) return res.json(loadJSON().points_table);
    try { const r = await pool.request().query("SELECT * FROM points_table ORDER BY points DESC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/health", (req, res) => res.json({ status: "ok", mode: useJSON ? "JSON" : "SQL" }));

app.listen(process.env.PORT || 3001, () => {
    console.log("✅ Server running on port " + (process.env.PORT || 3001));
});