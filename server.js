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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
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
let useJSON = false; // Forced to always attempt SSMS
const DB_FILE = path.join(__dirname, "db.json");
let MEMORY_DB = { users: [], teams: [], players: [], match_results: [], upcoming_matches: [], player_stats: [], points_table: [], tournaments: [], live_matches: [] };

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
            console.warn("⚠️ SQL Connection Failed:", e.message);
            useJSON = true;
        }
    }
    loadDB();
}
startServer();

// --- ROUTES ---
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        connected: !!pool && !useJSON,
        mode: useJSON ? "JSON" : "SQL"
    });
});

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

app.post("/update-user-photo", async (req, res) => {
    try {
        const { username, photo_url } = req.body;
        if (!username || !photo_url) return res.status(400).json({ message: "Username and photo required" });
        if (pool) {
            await pool.request()
                .input("u", sql.NVarChar, username)
                .input("p", sql.NVarChar(sql.MAX), photo_url)
                .query("UPDATE users SET photo_url = @p WHERE username = @u");
        }
        res.json({ message: "Photo updated successfully" });
    } catch (err) {
        console.error("Update photo error:", err);
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

// ================= TOURNAMENTS =================
app.get("/tournaments/:username", async (req, res) => {
    try {
        const { username } = req.params;
        if (pool) {
            console.log("Searching tournaments for:", username);
            const result = await pool.request()
                .input("u", sql.NVarChar, username.toLowerCase())
                .query(`
                    SELECT 
                        id, name, created_by, status, created_at,
                        ball_type AS ball, 
                        start_date AS startDate, 
                        end_date AS endDate 
                    FROM tournaments 
                    WHERE LOWER(created_by) = @u 
                    ORDER BY id DESC
                `);
            console.log(`Found ${result.recordset.length} tournaments for ${username}`);
            res.json(result.recordset);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error("GET tournaments error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/tournaments", async (req, res) => {
    try {
        const { name, created_by, ball_type, start_date, end_date } = req.body;
        if (!name || !created_by) return res.status(400).json({ message: "Name and created_by required" });
        if (pool) {
            const result = await pool.request()
                .input("n", sql.NVarChar, name)
                .input("c", sql.NVarChar, created_by)
                .input("b", sql.NVarChar, ball_type || null)
                .input("sd", sql.Date, start_date || null)
                .input("ed", sql.Date, end_date || null)
                .query(`
                    INSERT INTO tournaments (name, created_by, ball_type, start_date, end_date) 
                    OUTPUT INSERTED.id 
                    VALUES (@n, @c, @b, @sd, @ed)
                `);
            res.json({ success: true, id: result.recordset[0].id });
        } else {
            res.status(500).json({ message: "Database not connected" });
        }
    } catch (err) {
        console.error("POST tournament error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/tournaments/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (pool) {
            await pool.request()
                .input("id", sql.Int, id)
                .query("DELETE FROM tournaments WHERE id = @id");
        }
        res.json({ message: "Tournament deleted successfully" });
    } catch (err) {
        console.error("DELETE tournament error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/tournaments/name/:name", async (req, res) => {
    try {
        const { name } = req.params;
        if (pool) {
            await pool.request()
                .input("n", sql.NVarChar, name)
                .query("DELETE FROM tournaments WHERE name = @n");
        }
        res.json({ message: "Tournament deleted by name successfully" });
    } catch (err) {
        console.error("DELETE tournament by name error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/tournament-teams/:tournament_id", async (req, res) => {
    try {
        const { tournament_id } = req.params;
        if (pool) {
            const r = await pool.request()
                .input("tid", sql.Int, tournament_id)
                .query(`
                    SELECT tt.*,
                        (SELECT COUNT(*) FROM tournament_players tp 
                         WHERE tp.tournament_id = tt.tournament_id AND tp.team_name = tt.team_name) AS player_count
                    FROM tournament_teams tt
                    WHERE tt.tournament_id = @tid
                `);
            res.json(r.recordset);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error("GET tournament teams error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/tournament-teams", async (req, res) => {
    try {
        const { tournament_id, team_name, city, logo } = req.body;
        if (pool) {
            await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .input("city", sql.NVarChar, city || '')
                .input("logo", sql.NVarChar(sql.MAX), logo || '')
                .query("INSERT INTO tournament_teams (tournament_id, team_name, city, logo) VALUES (@tid, @tn, @city, @logo)");
            res.json({ success: true });
        } else {
            res.status(500).json({ message: "Database not connected" });
        }
    } catch (err) {
        console.error("POST tournament team error:", err);
        res.status(500).json({ error: err.message });
    }
});


// Rename a tournament team
app.put("/tournament-teams/:tournament_id/:old_name", async (req, res) => {
    try {
        const { tournament_id, old_name } = req.params;
        const { new_name } = req.body;
        if (!new_name) return res.status(400).json({ message: 'new_name required' });
        if (pool) {
            await pool.request()
                .input('tid', sql.Int, tournament_id)
                .input('on', sql.NVarChar, old_name)
                .input('nn', sql.NVarChar, new_name)
                .query('UPDATE tournament_teams SET team_name=@nn WHERE tournament_id=@tid AND team_name=@on');
            // Also update players table
            await pool.request()
                .input('tid', sql.Int, tournament_id)
                .input('on', sql.NVarChar, old_name)
                .input('nn', sql.NVarChar, new_name)
                .query('UPDATE tournament_players SET team_name=@nn WHERE tournament_id=@tid AND team_name=@on');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('PUT tournament team error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a tournament team
app.delete("/tournament-teams/:tournament_id/:team_name", async (req, res) => {
    try {
        const { tournament_id, team_name } = req.params;
        if (pool) {
            await pool.request()
                .input('tid', sql.Int, tournament_id)
                .input('tn', sql.NVarChar, team_name)
                .query('DELETE FROM tournament_teams WHERE tournament_id=@tid AND team_name=@tn');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE tournament team error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Set captain for a tournament team
app.put("/tournament-teams/:tournament_id/:team_name/captain", async (req, res) => {
    try {
        const { tournament_id, team_name } = req.params;
        const { captain } = req.body;
        if (!captain) return res.status(400).json({ message: 'captain required' });
        if (pool) {
            await pool.request()
                .input('tid', sql.Int, tournament_id)
                .input('tn', sql.NVarChar, team_name)
                .input('cap', sql.NVarChar, captain)
                .query('UPDATE tournament_teams SET captain=@cap WHERE tournament_id=@tid AND team_name=@tn');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('SET captain error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get captain for a tournament team
app.get("/tournament-teams/:tournament_id/:team_name/captain", async (req, res) => {
    try {
        const { tournament_id, team_name } = req.params;
        if (pool) {
            const r = await pool.request()
                .input('tid', sql.Int, tournament_id)
                .input('tn', sql.NVarChar, team_name)
                .query('SELECT captain FROM tournament_teams WHERE tournament_id=@tid AND team_name=@tn');
            res.json({ captain: r.recordset[0] ? r.recordset[0].captain : null });
        } else {
            res.json({ captain: null });
        }
    } catch (err) {
        console.error('GET captain error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/tournament-players/:tournament_id/:team_name", async (req, res) => {
    try {
        const { tournament_id, team_name } = req.params;
        if (pool) {
            const r = await pool.request()
                .input('tid', sql.Int, tournament_id)
                .input('tn', sql.NVarChar, team_name)
                .query('SELECT * FROM tournament_players WHERE tournament_id=@tid AND team_name=@tn');
            res.json(r.recordset);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error('GET tournament players error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/tournament-players", async (req, res) => {
    try {
        const { tournament_id, team_name, player_name, role, photo_url } = req.body;
        if (pool) {
            await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .input("pn", sql.NVarChar, player_name)
                .input("r", sql.NVarChar, role || null)
                .input("p", sql.NVarChar, photo_url || null)
                .query("INSERT INTO tournament_players (tournament_id, team_name, player_name, role, photo_url) VALUES (@tid, @tn, @pn, @r, @p)");
            res.json({ success: true });
        } else {
            res.status(500).json({ message: "Database not connected" });
        }
    } catch (err) {
        console.error("POST tournament player error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put("/tournament-players/:tournament_id/:team_name/:old_player_name", async (req, res) => {
    try {
        const { tournament_id, team_name, old_player_name } = req.params;
        const { player_name, role } = req.body;
        if (!player_name) return res.status(400).json({ message: "New player name is required" });

        if (pool) {
            // 1. Update player in tournament_players
            await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .input("opn", sql.NVarChar, old_player_name)
                .input("npn", sql.NVarChar, player_name)
                .input("r", sql.NVarChar, role || null)
                .query("UPDATE tournament_players SET player_name = @npn, role = @r WHERE tournament_id = @tid AND team_name = @tn AND player_name = @opn");
            
            // 2. Check if this player was the captain, if so update the captain column in tournament_teams
            const checkCap = await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .query("SELECT captain FROM tournament_teams WHERE tournament_id = @tid AND team_name = @tn");
            if (checkCap.recordset.length > 0 && checkCap.recordset[0].captain === old_player_name) {
                await pool.request()
                    .input("tid", sql.Int, tournament_id)
                    .input("tn", sql.NVarChar, team_name)
                    .input("npn", sql.NVarChar, player_name)
                    .query("UPDATE tournament_teams SET captain = @npn WHERE tournament_id = @tid AND team_name = @tn");
            }
            res.json({ success: true, message: "Player updated successfully" });
        } else {
            res.status(500).json({ message: "Database not connected" });
        }
    } catch (err) {
        console.error("PUT tournament player error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/tournament-players/:tournament_id/:team_name/:player_name", async (req, res) => {
    try {
        const { tournament_id, team_name, player_name } = req.params;
        if (pool) {
            await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .input("pn", sql.NVarChar, player_name)
                .query("DELETE FROM tournament_players WHERE tournament_id = @tid AND team_name = @tn AND player_name = @pn");
            res.json({ success: true, message: "Player deleted successfully" });
        } else {
            res.status(500).json({ message: "Database not connected" });
        }
    } catch (err) {
        console.error("DELETE tournament player error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ================= ALL MATCH TEAMS (for scoring dropdowns) =================
// Returns all unique teams + their players from tournament_teams & tournament_players
app.get("/all-match-teams", async (req, res) => {
    try {
        if (pool) {
            // Get all teams
            const teamsRes = await pool.request().query(
                "SELECT DISTINCT team_name FROM tournament_teams ORDER BY team_name"
            );
            // Get all players
            const playersRes = await pool.request().query(
                "SELECT team_name, player_name, role FROM tournament_players ORDER BY team_name, player_name"
            );
            const teamMap = {};
            teamsRes.recordset.forEach(t => {
                teamMap[t.team_name] = [];
            });
            playersRes.recordset.forEach(p => {
                if (!teamMap[p.team_name]) teamMap[p.team_name] = [];
                teamMap[p.team_name].push({ player_name: p.player_name, role: p.role });
            });
            res.json(teamMap);
        } else {
            res.json({});
        }
    } catch (err) {
        console.error("GET all-match-teams error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ================= TEAMS =================
app.post("/reset-password", async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        if (!username || !newPassword) return res.status(400).json({ message: "Username and new password required" });
        if (pool) {
            const result = await pool.request()
                .input("u", sql.NVarChar, username)
                .input("p", sql.NVarChar, newPassword)
                .query("UPDATE users SET password = @p WHERE username = @u");
            if (result.rowsAffected[0] === 0) {
                // If user doesn't exist in SQL, insert them so old localStorage users can migrate
                await pool.request()
                    .input("u", sql.NVarChar, username)
                    .input("p", sql.NVarChar, newPassword)
                    .query("INSERT INTO users (username, password) VALUES (@u, @p)");
            }
        }
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/delete-account", async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ message: "Username required" });
        if (pool) {
            await pool.request()
                .input("u", sql.NVarChar, username)
                .query("DELETE FROM users WHERE username = @u");
        }
        res.json({ message: "Account deleted successfully" });
    } catch (err) {
        console.error("Delete account error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/teams", async (req, res) => {
    try {
        if (useJSON || !pool) {
            // Ensure teams have IDs for deletion to work
            return res.json(MEMORY_DB.teams.map((t, i) => ({ id: t.id || i + 1, ...t })));
        }
        const r = await pool.request().query("SELECT * FROM teams");
        res.json(r.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/teams", async (req, res) => {
    try {
        if (useJSON || !pool) { 
            MEMORY_DB.teams.push({ id: Date.now(), team_name: req.body.name }); 
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
            MEMORY_DB.teams = MEMORY_DB.teams.filter((t, i) => (t.id || i + 1) != req.params.id && t.team_name !== req.params.id);
            saveDB();
            return res.send({ message: "Team Deleted" });
        }
        let reqId = req.params.id;
        if (!isNaN(reqId)) {
            await pool.request().input("id", sql.Int, reqId).query("DELETE FROM teams WHERE id=@id");
        } else {
            await pool.request().input("n", sql.NVarChar, reqId).query("DELETE FROM teams WHERE team_name=@n");
        }
        res.send({ message: "Team Deleted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ================= PLAYERS =================
app.get("/players/:team", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const filtered = MEMORY_DB.players
                .filter(p => p.team_name === req.params.team)
                .map((p, i) => ({ id: p.id || i + 1, ...p }));
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
            MEMORY_DB.players.push({ id: Date.now(), team_name, player_name, role });
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
            MEMORY_DB.players = MEMORY_DB.players.filter((p, i) => (p.id || i + 1) != req.params.id && p.team_name !== req.params.id);
            saveDB();
            return res.send({ message: "Player Deleted" });
        }
        let reqId = req.params.id;
        if (!isNaN(reqId)) {
            await pool.request().input("id", sql.Int, reqId).query("DELETE FROM players WHERE id=@id");
        } else {
            await pool.request().input("t", sql.NVarChar, reqId).query("DELETE FROM players WHERE team_name=@t");
        }
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
        const { 
            winner, loser, win_type, margin, played_on, organiser, commentary,
            match_id, t1_score, t2_score, t1_overs, t2_overs
        } = req.body;

        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.match_results.push({ 
                id, winner, loser, win_type, margin, played_on, organiser, commentary,
                match_id, t1_score, t2_score, t1_overs, t2_overs
            });
            saveDB();
            return res.json({ id });
        }
        const r = await pool.request()
            .input("w", sql.NVarChar, winner)
            .input("l", sql.NVarChar, loser)
            .input("wt", sql.NVarChar, win_type)
            .input("m", sql.NVarChar, margin)
            .input("p", sql.NVarChar, played_on)
            .input("org", sql.NVarChar, organiser || null)
            .input("comm", sql.NVarChar, commentary || null)
            .input("mid", sql.NVarChar, match_id ? match_id.toString() : null)
            .input("s1", sql.Int, t1_score || 0)
            .input("s2", sql.Int, t2_score || 0)
            .input("o1", sql.Decimal(4,1), t1_overs || 0)
            .input("o2", sql.Decimal(4,1), t2_overs || 0)
            .query(`INSERT INTO match_results (winner, loser, win_type, margin, played_on, organiser, commentary, match_id, t1_score, t2_score, t1_overs, t2_overs) 
                    OUTPUT INSERTED.id 
                    VALUES (@w, @l, @wt, @m, @p, @org, @comm, @mid, @s1, @s2, @o1, @o2)`);
        res.json({ id: r.recordset[0].id });
    } catch (err) {
        console.error("POST match-results error:", err);
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
        
        // Fetch regular upcoming matches (assuming regular ones don't have status yet, or we default to upcoming)
        const r1 = await pool.request().query("SELECT id, team1, team2, match_date, match_time, 'regular' as type FROM upcoming_matches");
        
        // Fetch tournament matches that are ONLY upcoming
        const r2 = await pool.request().query("SELECT id, team1, team2, match_date, match_time, 'tournament' as type FROM tournament_matches WHERE status = 'upcoming'");
        
        // Combine and sort
        const combined = [...r1.recordset, ...r2.recordset];
        combined.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
        
        res.json(combined);
    } catch (err) {
        console.error("GET upcoming-matches error:", err);
        res.status(500).send(err.message);
    }
});

app.post("/upcoming-matches", async (req, res) => {
    try {
        const { team1, team2, match_date, match_time } = req.body;
        if (!team1 || !team2 || !match_date) return res.status(400).json({ error: "Missing fields" });
        if (team1 === team2) return res.status(400).json({ error: "Same teams" });

        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.upcoming_matches.push({ id, team1, team2, match_date, match_time });
            saveDB();
            return res.json({ message: "Match scheduled", id });
        }

        const r = await pool.request()
            .input("t1", sql.NVarChar, team1)
            .input("t2", sql.NVarChar, team2)
            .input("d", sql.Date, match_date)
            .input("tm", sql.NVarChar, match_time || null)
            .query("INSERT INTO upcoming_matches (team1, team2, match_date, match_time) OUTPUT INSERTED.id VALUES (@t1, @t2, @d, @tm)");
        res.json({ message: "Match scheduled", id: r.recordset[0].id });
    } catch (err) {
        console.error("POST upcoming-matches error:", err);
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
        
        // Try deleting from upcoming_matches first
        const r1 = await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM upcoming_matches WHERE id=@id");
        
        // Also try marking tournament match as cancelled (or delete if that's preferred, but usually status update is safer)
        if (r1.rowsAffected[0] === 0) {
            await pool.request().input("id", sql.Int, req.params.id).query("UPDATE tournament_matches SET status='cancelled' WHERE id=@id");
        }
        
        res.json({ message: "Match deleted" });
    } catch (err) {
        console.error("DELETE upcoming-matches error:", err);
        res.status(500).send(err.message);
    }
});

// Conflicting old tournament routes removed. Using modern SQL routes defined above.

// ================= LIVE MATCHES =================
app.get("/live-matches", async (req, res) => {
    try {
        if (useJSON || !pool) return res.json(MEMORY_DB.live_matches || []);
        const r = await pool.request().query("SELECT * FROM live_matches ORDER BY updated_at DESC");
        res.json(r.recordset.map(row => ({ match_id: row.match_id, match_state: JSON.parse(row.match_state) })));
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/live-matches/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const match = (MEMORY_DB.live_matches || []).find(m => m.match_id == req.params.id);
            return res.json(match ? match.match_state : null);
        }
        const r = await pool.request().input("id", sql.NVarChar, req.params.id).query("SELECT match_state FROM live_matches WHERE match_id=@id");
        if (r.recordset.length === 0) return res.json(null);
        res.json(JSON.parse(r.recordset[0].match_state));
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/live-matches", async (req, res) => {
    try {
        const { match_id, match_state } = req.body;
        if (useJSON || !pool) {
            MEMORY_DB.live_matches = MEMORY_DB.live_matches || [];
            const idx = MEMORY_DB.live_matches.findIndex(m => m.match_id == match_id);
            if (idx > -1) MEMORY_DB.live_matches[idx] = { match_id, match_state };
            else MEMORY_DB.live_matches.push({ match_id, match_state });
            saveDB();
            return res.send("Ok");
        }
        await pool.request()
            .input("id", sql.NVarChar, match_id.toString())
            .input("state", sql.NVarChar, JSON.stringify(match_state))
            .query("IF EXISTS (SELECT 1 FROM live_matches WHERE match_id=@id) UPDATE live_matches SET match_state=@state, updated_at=GETDATE() WHERE match_id=@id ELSE INSERT INTO live_matches (match_id, match_state, updated_at) VALUES (@id, @state, GETDATE())");
        res.send("Ok");
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

app.get("/player-role/:player_name", async (req, res) => {
    try {
        if (!pool) return res.json({ role: 'Player' });
        const r = await pool.request().input("pn", sql.NVarChar, req.params.player_name).query("SELECT TOP 1 role FROM tournament_players WHERE player_name=@pn");
        if (r.recordset.length > 0) return res.json({ role: r.recordset[0].role });
        
        const r2 = await pool.request().input("pn", sql.NVarChar, req.params.player_name).query("SELECT TOP 1 role FROM player_profile WHERE player_name=@pn");
        if (r2.recordset.length > 0) return res.json({ role: r2.recordset[0].role });

        res.json({ role: 'Player' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= TOURNAMENT GALLERY =================
app.get("/tournament-gallery/:tournament_id", async (req, res) => {
    try {
        const { tournament_id } = req.params;
        if (pool) {
            const r = await pool.request()
                .input('tid', sql.Int, tournament_id)
                .query('SELECT * FROM tournament_gallery WHERE tournament_id=@tid ORDER BY uploaded_at DESC');
            res.json(r.recordset);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error('GET gallery error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/tournament-gallery", upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { tournament_id, uploaded_by, caption } = req.body;
        if (!tournament_id) return res.status(400).json({ error: 'tournament_id required' });
        cloudinary.uploader.upload_stream(
            { folder: 'kcp_gallery', resource_type: 'image' },
            async (error, result) => {
                if (error) return res.status(500).json({ error: error.message });
                if (pool) {
                    await pool.request()
                        .input('tid', sql.Int, tournament_id)
                        .input('url', sql.NVarChar(sql.MAX), result.secure_url)
                        .input('by', sql.NVarChar, uploaded_by || '')
                        .input('cap', sql.NVarChar, caption || '')
                        .query('INSERT INTO tournament_gallery (tournament_id, photo_url, uploaded_by, caption) VALUES (@tid, @url, @by, @cap)');
                }
                res.json({ success: true, url: result.secure_url });
            }
        ).end(req.file.buffer);
    } catch (err) {
        console.error('POST gallery error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/tournament-gallery/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (pool) {
            await pool.request().input('id', sql.Int, id).query('DELETE FROM tournament_gallery WHERE id=@id');
        }
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE gallery error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ================= TOURNAMENT MATCHES =================
app.get("/tournament-matches/:tournament_id", async (req, res) => {
    try {
        const { tournament_id } = req.params;
        if (!pool) return res.json([]);
        const result = await pool.request()
            .input("tid", sql.Int, tournament_id)
            .query(`
                SELECT 
                    tm.*, 
                    mr.t1_score, mr.t2_score, mr.t1_overs, mr.t2_overs,
                    mr.winner as result_winner
                FROM tournament_matches tm
                LEFT JOIN match_results mr ON CAST(tm.id AS NVARCHAR(100)) = mr.match_id
                WHERE tm.tournament_id = @tid 
                ORDER BY tm.match_date ASC, tm.created_at ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("GET matches error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/tournament-matches", async (req, res) => {
    try {
        const { tournament_id, team1, team2, match_date, match_time, result, status } = req.body;
        if (!pool) return res.status(500).json({ message: "No SQL Connection" });
        await pool.request()
            .input("tid", sql.Int, tournament_id)
            .input("t1", sql.NVarChar, team1)
            .input("t2", sql.NVarChar, team2)
            .input("md", sql.Date, match_date || null)
            .input("mt", sql.NVarChar, match_time || null)
            .input("res", sql.NVarChar, result || null)
            .input("st", sql.NVarChar, status || 'upcoming')
            .query(`
                INSERT INTO tournament_matches (tournament_id, team1, team2, match_date, match_time, result, status)
                VALUES (@tid, @t1, @t2, @md, @mt, @res, @st)
            `);
        res.json({ success: true });
    } catch (err) {
        console.error("POST match error:", err);
        res.status(500).json({ error: err.message });
    }
});

// New endpoint to update tournament match result and status
app.patch("/tournament-matches/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { result, status, toss_info } = req.body;
        if (!pool) return res.status(500).json({ message: "No SQL Connection" });
        
        let query = "UPDATE tournament_matches SET id=id";
        const request = pool.request().input("id", sql.Int, id);
        
        if (result !== undefined) { query += ", result=@res"; request.input("res", sql.NVarChar, result); }
        if (status !== undefined) { query += ", status=@st"; request.input("st", sql.NVarChar, status); }
        if (toss_info !== undefined) { query += ", toss_info=@toss"; request.input("toss", sql.NVarChar, toss_info); }
        
        query += " WHERE id=@id";
        await request.query(query);
        res.json({ success: true });
    } catch (err) {
        console.error("PATCH match error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/tournament-matches/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!pool) return res.status(500).json({ message: "No SQL Connection" });
        await pool.request()
            .input("id", sql.Int, id)
            .query("DELETE FROM tournament_matches WHERE id = @id");
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE match error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/health", (req, res) => res.json({ status: "ok", mode: useJSON ? "JSON" : "SQL", connected: !!pool }));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`✅ Server Live on port ${PORT}`));

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is busy. Auto-fixing it for you...`);
    const { exec } = require('child_process');
    
    // Command to forcefully close the old server
    const cmd = process.platform === 'win32' 
      ? `powershell.exe -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force"`
      : `lsof -i :${PORT} -t | xargs kill -9`;
      
    exec(cmd, (err) => {
      if (err) {
        console.error("❌ Auto-fix failed. Please close the other terminal manually.");
        process.exit(1);
      }
      console.log(`✅ Old server closed! Starting the new one...`);
      setTimeout(() => {
        server.close();
        app.listen(PORT, () => console.log(`✅ Server Live on port ${PORT}`));
      }, 1000);
    });
  } else {
    console.error(e);
  }
});