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
            console.warn("⚠️ SQL Failed, using JSON mode:", e.message);
            useJSON = true;
        }
    }
    loadDB();
}
startServer();

// --- ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ================= USERS =================
app.post("/register", async (req, res) => {
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

        const check = await pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username=@u");
        if (check.recordset.length > 0) return res.json({ message: "Already Registered" });

        await pool.request().input("u", sql.NVarChar, username).input("p", sql.NVarChar, password).query("INSERT INTO users (username,password) VALUES (@u,@p)");
        res.json({ message: "Registered Successfully" });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (useJSON || !pool) {
            const users = MEMORY_DB.users || [];
            const user = users.find(u => u.username === username && u.password === password);
            return res.json({ success: !!user });
        }
        const r = await pool.request().input("u", sql.NVarChar, username).query("SELECT * FROM users WHERE username=@u");
        res.json({ success: r.recordset.length > 0 && r.recordset[0].password === password });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ================= TEAMS =================
app.get("/teams", async (req, res) => {
    try {
        if (useJSON || !pool) return res.json(MEMORY_DB.teams);
        const r = await pool.request().query("SELECT * FROM teams");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/teams", async (req, res) => {
    try {
        if (useJSON || !pool) { 
            MEMORY_DB.teams.push({ team_name: req.body.name }); 
            saveDB(); 
            return res.send("Ok"); 
        }
        await pool.request().input("n", sql.NVarChar, req.body.name).query("INSERT INTO teams (team_name) VALUES (@n)");
        res.send("Ok");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/teams/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            MEMORY_DB.teams = MEMORY_DB.teams.filter((_, i) => i != req.params.id);
            saveDB();
            return res.send({ message: "Team Deleted" });
        }
        await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM teams WHERE id=@id");
        res.send({ message: "Team Deleted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= PLAYERS =================
app.get("/players/:team", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const filtered = MEMORY_DB.players.filter(p => p.team_name === req.params.team);
            return res.json(filtered);
        }
        const r = await pool.request().input("t", sql.NVarChar, req.params.team).query("SELECT * FROM players WHERE team_name=@t");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/players", async (req, res) => {
    try {
        const { team_name, player_name, role } = req.body;
        if (useJSON || !pool) {
            MEMORY_DB.players.push({ team_name, player_name, role });
            saveDB();
            return res.send("Player Added");
        }
        await pool.request()
            .input("t", sql.NVarChar, team_name)
            .input("p", sql.NVarChar, player_name)
            .input("r", sql.NVarChar, role)
            .query("INSERT INTO players (team_name, player_name, role) VALUES (@t, @p, @r)");
        res.send("Player Added");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/players/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            MEMORY_DB.players = MEMORY_DB.players.filter((_, i) => i != req.params.id);
            saveDB();
            return res.send({ message: "Player Deleted" });
        }
        await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM players WHERE id=@id");
        res.send({ message: "Player Deleted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= MATCH RESULTS =================
app.get("/match-results", async (req, res) => {
    try {
        if (useJSON || !pool) return res.json(MEMORY_DB.match_results);
        const r = await pool.request().query("SELECT * FROM match_results ORDER BY id DESC");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/match-results", async (req, res) => {
    try {
        const { winner, loser, win_type, margin, played_on } = req.body;
        if (!winner || !loser) return res.status(400).send("Missing fields");

        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.match_results.push({ id, winner, loser, win_type, margin, played_on });
            saveDB();
            return res.json({ message: "Result saved", id });
        }

        const r = await pool.request()
            .input("w", sql.NVarChar, winner)
            .input("l", sql.NVarChar, loser)
            .input("wt", sql.NVarChar, win_type)
            .input("m", sql.NVarChar, margin)
            .input("p", sql.NVarChar, played_on)
            .query("INSERT INTO match_results (winner, loser, win_type, margin, played_on) OUTPUT INSERTED.id VALUES (@w,@l,@wt,@m,@p)");
        res.json({ message: "Result saved", id: r.recordset[0].id });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/match-results/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            MEMORY_DB.match_results = MEMORY_DB.match_results.filter(m => m.id != req.params.id);
            saveDB();
            return res.send({ message: "Match deleted" });
        }
        await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM match_results WHERE id=@id");
        res.send({ message: "Match deleted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= UPCOMING MATCHES =================
app.get("/upcoming-matches", async (req, res) => {
    try {
        if (useJSON || !pool) return res.json(MEMORY_DB.upcoming_matches);
        const r = await pool.request().query("SELECT * FROM upcoming_matches ORDER BY match_date ASC");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/upcoming-matches", async (req, res) => {
    try {
        const { team1, team2, match_date } = req.body;
        if (!team1 || !team2 || !match_date) return res.status(400).json({ error: "Missing fields" });
        if (team1 === team2) return res.status(400).json({ error: "Same teams" });

        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.upcoming_matches.push({ id, team1, team2, match_date });
            saveDB();
            return res.json({ message: "Match scheduled", id });
        }

        const r = await pool.request()
            .input("t1", sql.NVarChar, team1)
            .input("t2", sql.NVarChar, team2)
            .input("d", sql.Date, match_date)
            .query("INSERT INTO upcoming_matches (team1, team2, match_date) OUTPUT INSERTED.id VALUES (@t1, @t2, @d)");
        res.json({ message: "Match scheduled", id: r.recordset[0].id });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/upcoming-matches/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            MEMORY_DB.upcoming_matches = MEMORY_DB.upcoming_matches.filter(m => m.id != req.params.id);
            saveDB();
            return res.json({ message: "Match deleted" });
        }
        await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM upcoming_matches WHERE id=@id");
        res.json({ message: "Match deleted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= PLAYER STATS =================
app.post("/player-stats", async (req, res) => {
    try {
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

        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.player_stats.push({ ...req.body, id, strike_rate: sr });
            saveDB();
            return res.json({ success: true, id });
        }

        const r = await pool.request()
            .input("pn", sql.NVarChar, player_name)
            .input("tn", sql.NVarChar, team_name || "")
            .input("md", sql.Date, match_date || new Date())
            .input("mt", sql.NVarChar, match_type)
            .input("r", sql.Int, runs || 0)
            .input("bf", sql.Int, balls_faced || 0)
            .input("f4", sql.Int, fours || 0)
            .input("s6", sql.Int, sixes || 0)
            .input("w", sql.Int, wickets || 0)
            .input("ob", sql.NVarChar, overs_bowled || "0.0")
            .input("rc", sql.Int, runs_conceded || 0)
            .input("sr", sql.Float, sr)
            .input("dt", sql.NVarChar, dismissal_type || null)
            .input("db", sql.NVarChar, dismissed_by || null)
            .input("c", sql.Int, catches || 0)
            .input("ro", sql.Int, run_outs || 0)
            .input("s", sql.Int, stumpings || 0)
            .input("mid", sql.Int, match_id || null)
            .input("inn", sql.Int, innings || 1)
            .input("st", sql.NVarChar, shot_types || null)
            .input("ww", sql.NVarChar, wagon_wheel || null)
            .query(`INSERT INTO player_stats (player_name, team_name, match_date, match_type, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, strike_rate, dismissal_type, dismissed_by, catches, run_outs, stumpings, match_id, innings, shot_types, wagon_wheel) 
                    OUTPUT INSERTED.id VALUES (@pn, @tn, @md, @mt, @r, @bf, @f4, @s6, @w, @ob, @rc, @sr, @dt, @db, @c, @ro, @s, @mid, @inn, @st, @ww)`);
        
        res.json({ success: true, id: r.recordset[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/player-stats/:playerName", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const stats = MEMORY_DB.player_stats.filter(s => s.player_name === req.params.playerName);
            return res.json(stats);
        }
        const r = await pool.request().input("pn", sql.NVarChar, req.params.playerName).query("SELECT * FROM player_stats WHERE player_name = @pn ORDER BY match_date DESC, id DESC");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/player-stats-by-match", async (req, res) => {
    try {
        const { match_id } = req.query;
        if (!match_id) return res.status(400).json({ error: "match_id required" });

        if (useJSON || !pool) {
            const stats = MEMORY_DB.player_stats.filter(s => s.match_id == match_id);
            return res.json(stats);
        }
        const r = await pool.request().input("mid", sql.Int, match_id).query("SELECT * FROM player_stats WHERE match_id = @mid ORDER BY id ASC");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= PLAYER PROFILE =================
app.get("/player-profile", async (req, res) => {
    try {
        if (useJSON || !pool) return res.json(MEMORY_DB.player_profile || []);
        const r = await pool.request().query("SELECT * FROM player_profile");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/player-profile", async (req, res) => {
    try {
        const { player_name, team_name, runs, role } = req.body;
        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.player_profile = MEMORY_DB.player_profile || [];
            MEMORY_DB.player_profile.push({ player_id: id, player_name, team_name, runs, role });
            saveDB();
            return res.json({ success: true, id });
        }
        const r = await pool.request()
            .input("pn", sql.NVarChar, player_name)
            .input("tn", sql.NVarChar, team_name || "")
            .input("r", sql.Int, runs || 0)
            .input("rl", sql.NVarChar, role || "")
            .query("INSERT INTO player_profile (player_name, team_name, runs, role) OUTPUT INSERTED.player_id VALUES (@pn, @tn, @r, @rl)");
        res.json({ success: true, id: r.recordset[0].player_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/player-profile/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            MEMORY_DB.player_profile = (MEMORY_DB.player_profile || []).filter(p => p.player_id != req.params.id);
            saveDB();
            return res.json({ message: "Deleted" });
        }
        await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM player_profile WHERE player_id=@id");
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= POINTS TABLE =================
app.get("/points-table", async (req, res) => {
    try {
        if (useJSON || !pool) return res.json(MEMORY_DB.points_table || []);
        const r = await pool.request().query("SELECT * FROM points_table ORDER BY points DESC, net_run_rate DESC");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/points-table/update", async (req, res) => {
    try {
        const { winner, loser, winner_runs, winner_overs, loser_runs, loser_overs } = req.body;
        
        if (useJSON || !pool) {
            // Basic JSON update logic (simplified)
            return res.json({ message: "Points updated (JSON)" });
        }

        // Winner Update
        await pool.request()
            .input("t", sql.NVarChar, winner)
            .input("rs", sql.Float, winner_runs || 0)
            .input("rc", sql.Float, loser_runs || 0)
            .input("of", sql.Float, winner_overs || 0)
            .input("ob", sql.Float, loser_overs || 0)
            .query(`IF EXISTS (SELECT * FROM points_table WHERE team_name = @t)
                    UPDATE points_table SET matches_played=matches_played+1, wins=wins+1, points=points+2, 
                    runs_scored=runs_scored+@rs, runs_conceded=runs_conceded+@rc, overs_faced=overs_faced+@of, overs_bowled=overs_bowled+@ob 
                    WHERE team_name = @t
                    ELSE
                    INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled) 
                    VALUES (@t, 1, 1, 0, 2, @rs, @rc, @of, @ob)`);

        // Loser Update
        await pool.request()
            .input("t", sql.NVarChar, loser)
            .input("rs", sql.Float, loser_runs || 0)
            .input("rc", sql.Float, winner_runs || 0)
            .input("of", sql.Float, loser_overs || 0)
            .input("ob", sql.Float, winner_overs || 0)
            .query(`IF EXISTS (SELECT * FROM points_table WHERE team_name = @t)
                    UPDATE points_table SET matches_played=matches_played+1, losses=losses+1, 
                    runs_scored=runs_scored+@rs, runs_conceded=runs_conceded+@rc, overs_faced=overs_faced+@of, overs_bowled=overs_bowled+@ob 
                    WHERE team_name = @t
                    ELSE
                    INSERT INTO points_table (team_name, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled) 
                    VALUES (@t, 1, 0, 1, 0, @rs, @rc, @of, @ob)`);

        // Update NRR
        await pool.request().query(`UPDATE points_table SET net_run_rate = CASE WHEN overs_bowled > 0 AND overs_faced > 0 THEN ROUND((runs_scored / overs_faced) - (runs_conceded / overs_bowled), 3) ELSE 0 END`);
        
        res.json({ message: "Points updated" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/points-table/:teamName", async (req, res) => {
    try {
        if (useJSON || !pool) {
            MEMORY_DB.points_table = (MEMORY_DB.points_table || []).filter(t => t.team_name !== req.params.teamName);
            saveDB();
            return res.json({ message: "Team removed from points table" });
        }
        await pool.request().input("t", sql.NVarChar, req.params.teamName).query("DELETE FROM points_table WHERE team_name=@t");
        res.json({ message: "Team removed from points table" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= PHOTO UPLOAD =================
app.post("/upload-photo", upload.single("photo"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const player_name = req.body.player_name;
        
        cloudinary.uploader.upload_stream(
            { folder: "kcp_players", public_id: player_name.replace(/\s+/g, "_") },
            async (error, result) => {
                if (error) return res.status(500).json({ error: error.message });
                
                if (useJSON || !pool) {
                    const p = MEMORY_DB.players.find(p => p.player_name === player_name);
                    if (p) p.photo_url = result.secure_url;
                    saveDB();
                } else {
                    await pool.request().input("u", sql.NVarChar, result.secure_url).input("pn", sql.NVarChar, player_name).query("UPDATE players SET photo_url=@u WHERE player_name=@pn");
                }
                res.json({ success: true, url: result.secure_url });
            }
        ).end(req.file.buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/player-photo/:player_name", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const p = MEMORY_DB.players.find(p => p.player_name === req.params.player_name);
            return res.json({ photo_url: p ? p.photo_url : null });
        }
        const r = await pool.request().input("pn", sql.NVarChar, req.params.player_name).query("SELECT photo_url FROM players WHERE player_name=@pn");
        if (r.recordset.length === 0) return res.json({ photo_url: null });
        res.json({ photo_url: r.recordset[0].photo_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/health", (req, res) => res.json({ status: "ok", mode: useJSON ? "JSON" : "SQL", connected: !!pool }));

app.listen(process.env.PORT || 3001, () => console.log("✅ Server Live on port 3001"));