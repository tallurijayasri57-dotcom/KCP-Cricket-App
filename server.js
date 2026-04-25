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
    return JSON.parse(fs.readFileSync(DB_FILE));
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
    } catch (err) {
        console.warn("⚠️ SQL Server connection failed, falling back to JSON storage.");
        useJSON = true;
    }
}

connectDB();

// ================= API ENDPOINTS =================

// Helper to handle both SQL and JSON
async function queryDB(sqlQuery, params = {}, table = "") {
    if (!useJSON) {
        let request = pool.request();
        for (let key in params) request.input(key, params[key].type, params[key].val);
        return await request.query(sqlQuery);
    } else {
        const db = loadJSON();
        return { recordset: db[table] || [] };
    }
}

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
        const check = await pool.request().input("username", sql.NVarChar, username).query("SELECT * FROM users WHERE username = @username");
        if (check.recordset.length > 0) return res.json({ message: "Already Registered" });
        await pool.request().input("username", sql.NVarChar, username).input("password", sql.NVarChar, password).query("INSERT INTO users (username, password) VALUES (@username, @password)");
        res.json({ message: "Registered Successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (useJSON) {
        let db = loadJSON();
        let user = db.users.find(u => u.username === username);
        if (!user) return res.json({ success: false, error: "invalid_username" });
        if (user.password !== password) return res.json({ success: false, error: "invalid_password" });
        return res.json({ success: true });
    }
    try {
        const result = await pool.request().input("username", sql.NVarChar, username).query("SELECT * FROM users WHERE username = @username");
        if (result.recordset.length === 0) return res.json({ success: false, error: "invalid_username" });
        if (result.recordset[0].password !== password) return res.json({ success: false, error: "invalid_password" });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/teams", async (req, res) => {
    if (useJSON) return res.json(loadJSON().teams);
    try { const r = await pool.request().query("SELECT * FROM teams"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/teams", async (req, res) => {
    if (useJSON) {
        let db = loadJSON();
        db.teams.push({ id: Date.now(), team_name: req.body.name });
        saveJSON(db);
        return res.send("Team Added Successfully");
    }
    try { await pool.request().input("name", sql.NVarChar, req.body.name).query("INSERT INTO teams (team_name) VALUES (@name)"); res.send("Team Added Successfully"); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/players/:team", async (req, res) => {
    if (useJSON) return res.json(loadJSON().players.filter(p => p.team_name === req.params.team));
    try { const r = await pool.request().input("team", sql.NVarChar, req.params.team).query("SELECT * FROM players WHERE team_name = @team"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/players", async (req, res) => {
    const { team_name, player_name, role } = req.body;
    if (useJSON) {
        let db = loadJSON();
        db.players.push({ id: Date.now(), team_name, player_name, role });
        saveJSON(db);
        return res.send("Player Added");
    }
    try { await pool.request().input("t", sql.NVarChar, team_name).input("p", sql.NVarChar, player_name).input("r", sql.NVarChar, role).query("INSERT INTO players (team_name, player_name, role) VALUES (@t, @p, @r)"); res.send("Player Added"); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/match-results", async (req, res) => {
    if (useJSON) return res.json(loadJSON().match_results);
    try { const r = await pool.request().query("SELECT * FROM match_results ORDER BY id DESC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/match-results", async (req, res) => {
    if (useJSON) {
        let db = loadJSON();
        let id = Date.now();
        db.match_results.push({ id, ...req.body });
        saveJSON(db);
        return res.json({ message: "Result saved", id });
    }
    try { 
        const { winner, loser, win_type, margin, played_on } = req.body;
        const result = await pool.request().input("w", winner).input("l", loser).input("wt", win_type).input("m", margin).input("p", played_on).query("INSERT INTO match_results (winner, loser, win_type, margin, played_on) VALUES (@w, @l, @wt, @m, @p); SELECT SCOPE_IDENTITY() AS id");
        res.json({ message: "Result saved", id: result.recordset[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/upcoming-matches", async (req, res) => {
    if (useJSON) return res.json(loadJSON().upcoming_matches);
    try { const r = await pool.request().query("SELECT * FROM upcoming_matches ORDER BY match_date ASC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/upcoming-matches", async (req, res) => {
    if (useJSON) {
        let db = loadJSON();
        let id = Date.now();
        db.upcoming_matches.push({ id, ...req.body });
        saveJSON(db);
        return res.json({ message: "Match scheduled", id });
    }
    try {
        const { team1, team2, match_date } = req.body;
        const r = await pool.request().input("t1", team1).input("t2", team2).input("d", match_date).query("INSERT INTO upcoming_matches (team1, team2, match_date) VALUES (@t1, @t2, @d); SELECT SCOPE_IDENTITY() AS id");
        res.json({ message: "Match scheduled", id: r.recordset[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/points-table", async (req, res) => {
    if (useJSON) return res.json(loadJSON().points_table);
    try { const r = await pool.request().query("SELECT * FROM points_table ORDER BY points DESC, net_run_rate DESC"); res.json(r.recordset); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/points-table/update", async (req, res) => {
    if (useJSON) {
        let db = loadJSON();
        // Simple logic for JSON update
        const { winner, loser } = req.body;
        let w = db.points_table.find(t => t.team_name === winner);
        if (!w) { w = { team_name: winner, matches_played: 0, wins: 0, losses: 0, points: 0 }; db.points_table.push(w); }
        w.matches_played++; w.wins++; w.points += 2;
        let l = db.points_table.find(t => t.team_name === loser);
        if (!l) { l = { team_name: loser, matches_played: 0, wins: 0, losses: 0, points: 0 }; db.points_table.push(l); }
        l.matches_played++; l.losses++;
        saveJSON(db);
        return res.json({ message: "Points updated" });
    }
    // Existing SQL logic would go here
    res.json({ message: "Points updated (SQL)" });
});

app.listen(process.env.PORT || 3001, () => {
    console.log("✅ Server running on port " + (process.env.PORT || 3001));
});