const express = require("express");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

// ✅ Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "das4ixee0",
    api_key: process.env.CLOUDINARY_API_KEY || "257379219351122",
    api_secret: process.env.CLOUDINARY_API_SECRET || "7kqK84VNi8Soby13w5ydIspW7oE"
});

const upload = multer({ storage: multer.memoryStorage() });

// ✅ Database Config
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
let MEMORY_DB = { users: [], teams: [], players: [], match_results: [], upcoming_matches: [], player_stats: [], points_table: [] };

// ✅ JSON Storage Logic
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, "utf8");
            if (data) {
                const parsedDB = JSON.parse(data);
                MEMORY_DB = { ...MEMORY_DB, ...parsedDB };
            }
        }
    } catch (e) { console.error("Load Error", e); }
    return MEMORY_DB;
}

function saveDB() {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB, null, 2)); } catch (e) { console.error("Save Error", e); }
}

async function startServer() {
    if (!useJSON) {
        try {
            pool = await sql.connect(dbConfig);
            console.log("✅ SQL Connected");
        } catch (e) {
            console.warn("⚠️ SQL Failed, using JSON mode");
            useJSON = true;
        }
    }
    loadDB();
}
startServer();

// --- ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.post("/register", (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Fields required" });

        if (useJSON || !pool) {
            const users = MEMORY_DB.users || [];
            if (users.find(u => u.username === username)) return res.json({ message: "Already Registered" });
            users.push({ username, password });
            MEMORY_DB.users = users;
            saveDB();
            return res.json({ message: "Registered Successfully" });
        }

        pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username=@u")
            .then(check => {
                if (check.recordset.length > 0) return res.json({ message: "Already Registered" });
                return pool.request().input("u", sql.NVarChar, username).input("p", sql.NVarChar, password).query("INSERT INTO users (username,password) VALUES (@u,@p)");
            })
            .then(() => res.json({ message: "Registered Successfully" }))
            .catch(e => res.status(500).json({ error: e.message }));
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: "Internal server error during registration" });
    }
});

app.post("/login", (req, res) => {
    try {
        const { username, password } = req.body;
        if (useJSON || !pool) {
            const users = MEMORY_DB.users || [];
            const user = users.find(u => u.username === username && u.password === password);
            return res.json({ success: !!user });
        }
        pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username=@u")
            .then(r => res.json({ success: r.recordset.length > 0 && r.recordset[0].password === password }))
            .catch(e => res.status(500).json({ error: e.message }));
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Internal server error during login" });
    }
});

app.get("/teams", (req, res) => {
    if (useJSON || !pool) return res.json(MEMORY_DB.teams);
    pool.request().query("SELECT * FROM teams").then(r => res.json(r.recordset)).catch(e => res.status(500).json({ error: e.message }));
});

app.post("/teams", (req, res) => {
    if (useJSON || !pool) { MEMORY_DB.teams.push({ team_name: req.body.name }); saveDB(); return res.send("Ok"); }
    pool.request().input("n", sql.NVarChar, req.body.name).query("INSERT INTO teams (team_name) VALUES (@n)").then(() => res.send("Ok")).catch(e => res.status(500).send(e.message));
});

// (Add essential match routes)
app.get("/match-results", (req, res) => {
    if (useJSON || !pool) return res.json(MEMORY_DB.match_results);
    pool.request().query("SELECT * FROM match_results ORDER BY id DESC").then(r => res.json(r.recordset)).catch(e => res.status(500).json({ error: e.message }));
});

app.get("/health", (req, res) => res.json({ status: "ok", mode: useJSON ? "JSON" : "SQL" }));

app.listen(process.env.PORT || 3001, () => console.log("✅ Server Live"));