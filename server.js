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
let MEMORY_DB = { users: [], teams: [], players: [], match_results: [], upcoming_matches: [], player_stats: [], points_table: [], tournaments: [], live_matches: [], player_profiles: [] };

// ✅ JSON Storage Logic
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, "utf8");
            if (data) {
                const parsedDB = JSON.parse(data);
                MEMORY_DB = { ...MEMORY_DB, ...parsedDB };
                MEMORY_DB.player_profiles = MEMORY_DB.player_profiles || MEMORY_DB.player_profile || [];
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
            // Ensure extra columns exist (safe migrations)
            const migrations = [
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournaments'       AND COLUMN_NAME='logo')    ALTER TABLE tournaments       ADD logo     NVARCHAR(MAX) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournaments'       AND COLUMN_NAME='organiser') ALTER TABLE tournaments       ADD organiser NVARCHAR(200) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournaments'       AND COLUMN_NAME='city')      ALTER TABLE tournaments       ADD city      NVARCHAR(200) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournaments'       AND COLUMN_NAME='ground')    ALTER TABLE tournaments       ADD ground    NVARCHAR(200) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_teams'  AND COLUMN_NAME='captain')  ALTER TABLE tournament_teams  ADD captain  NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_teams'  AND COLUMN_NAME='city')     ALTER TABLE tournament_teams  ADD city     NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_teams'  AND COLUMN_NAME='logo')     ALTER TABLE tournament_teams  ADD logo     NVARCHAR(MAX) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='match_id')  ALTER TABLE match_results     ADD match_id NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='tournament_id') ALTER TABLE match_results ADD tournament_id NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='series_name') ALTER TABLE match_results   ADD series_name NVARCHAR(200) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t1_name')    ALTER TABLE match_results     ADD t1_name NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t1_score')   ALTER TABLE match_results     ADD t1_score NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t1_overs')   ALTER TABLE match_results     ADD t1_overs NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t2_name')    ALTER TABLE match_results     ADD t2_name NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t2_score')   ALTER TABLE match_results     ADD t2_score NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t2_overs')   ALTER TABLE match_results     ADD t2_overs NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t1_wickets') ALTER TABLE match_results     ADD t1_wickets INT NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='t2_wickets') ALTER TABLE match_results     ADD t2_wickets INT NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='player_stats'      AND COLUMN_NAME='opponent_team') ALTER TABLE player_stats  ADD opponent_team NVARCHAR(100) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='match_results'     AND COLUMN_NAME='toss_info')  ALTER TABLE match_results     ADD toss_info NVARCHAR(MAX) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_matches' AND COLUMN_NAME='toss_info') ALTER TABLE tournament_matches ADD toss_info NVARCHAR(MAX) NULL`,

                // Player Style Migrations
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='players' AND COLUMN_NAME='batting_style') ALTER TABLE players ADD batting_style NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='players' AND COLUMN_NAME='bowling_style') ALTER TABLE players ADD bowling_style NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_players' AND COLUMN_NAME='batting_style') ALTER TABLE tournament_players ADD batting_style NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_players' AND COLUMN_NAME='bowling_style') ALTER TABLE tournament_players ADD bowling_style NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='player_profiles' AND COLUMN_NAME='batting_style') ALTER TABLE player_profiles ADD batting_style NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='player_profiles' AND COLUMN_NAME='bowling_style') ALTER TABLE player_profiles ADD bowling_style NVARCHAR(50) NULL`,
                `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tournament_gallery' AND COLUMN_NAME='caption') ALTER TABLE tournament_gallery ADD caption NVARCHAR(MAX) NULL`,
            ];
            for (const mig of migrations) {
                try { await pool.request().query(mig); } catch (e) { console.warn("Migration warning:", e.message); }
            }
            console.log("✅ Schema migrations applied");
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

// Get ALL tournaments from all users (for home page global display)
app.get("/all-tournaments", async (req, res) => {
    try {
        if (pool) {
            const result = await pool.request().query(`
                SELECT 
                    id, name, created_by, organiser, status, created_at,
                    ball_type AS ball, 
                    start_date AS startDate, 
                    end_date AS endDate,
                    logo, city, ground
                FROM tournaments 
                ORDER BY id DESC
            `);
            res.json(result.recordset);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error("GET all-tournaments error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/tournaments/:username", async (req, res) => {
    try {
        const { username } = req.params;
        if (pool) {
            console.log("Searching tournaments for:", username);
            const result = await pool.request()
                .input("u", sql.NVarChar, username.toLowerCase())
                .query(`
                    SELECT 
                        id, name, created_by, organiser, status, created_at,
                        ball_type AS ball, 
                        start_date AS startDate, 
                        end_date AS endDate,
                        logo, city, ground
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
        const { name, created_by, organiser, ball_type, start_date, end_date, logo, city, ground } = req.body;
        if (!name || !created_by) return res.status(400).json({ message: "Name and created_by required" });
        if (pool) {
            const result = await pool.request()
                .input("n", sql.NVarChar, name)
                .input("c", sql.NVarChar, created_by)
                .input("org", sql.NVarChar, organiser || null)
                .input("b", sql.NVarChar, ball_type || null)
                .input("sd", sql.Date, start_date || null)
                .input("ed", sql.Date, end_date || null)
                .input("logo", sql.NVarChar(sql.MAX), logo || null)
                .input("city", sql.NVarChar, city || null)
                .input("ground", sql.NVarChar, ground || null)
                .query(`
                    INSERT INTO tournaments (name, created_by, organiser, ball_type, start_date, end_date, logo, city, ground) 
                    OUTPUT INSERTED.id 
                    VALUES (@n, @c, @org, @b, @sd, @ed, @logo, @city, @ground)
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

app.patch("/tournaments/:id/logo", async (req, res) => {
    try {
        const { id } = req.params;
        const { logo } = req.body;
        if (!logo) return res.status(400).json({ message: "logo required" });
        if (pool) {
            await pool.request()
                .input("id", sql.Int, id)
                .input("logo", sql.NVarChar(sql.MAX), logo)
                .query("UPDATE tournaments SET logo = @logo WHERE id = @id");
        }
        res.json({ success: true });
    } catch (err) {
        console.error("PATCH tournament logo error:", err);
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
            // Base insert with required columns only
            const r = await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .query("INSERT INTO tournament_teams (tournament_id, team_name) OUTPUT INSERTED.id VALUES (@tid, @tn)");
            const newId = r.recordset[0].id;
            // Optionally update city/logo if columns exist (added by migration)
            if (city || logo) {
                try {
                    await pool.request()
                        .input("id", sql.Int, newId)
                        .input("city", sql.NVarChar, city || '')
                        .input("logo", sql.NVarChar(sql.MAX), logo || '')
                        .query("UPDATE tournament_teams SET city=@city, logo=@logo WHERE id=@id");
                } catch (e) { /* city/logo columns may not exist yet, ignore */ }
            }
            res.json({ success: true, id: newId });
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
                .query(`
                    SELECT
                        tp.id, tp.tournament_id, tp.team_name, tp.player_name,
                        COALESCE(NULLIF(tp.role, ''), NULLIF(pp.role, ''), 'Player') AS role,
                        COALESCE(NULLIF(tp.batting_style, ''), NULLIF(pp.batting_style, '')) AS batting_style,
                        COALESCE(NULLIF(tp.bowling_style, ''), NULLIF(pp.bowling_style, '')) AS bowling_style,
                        COALESCE(NULLIF(tp.photo_url, ''), NULLIF(pp.photo_url, '')) AS photo_url
                    FROM tournament_players tp
                    LEFT JOIN player_profiles pp ON tp.player_name = pp.player_name
                    WHERE tp.tournament_id = @tid AND tp.team_name = @tn
                `);
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
            // 1. Save to Tournament Players
            await pool.request()
                .input("tid", sql.Int, tournament_id)
                .input("tn", sql.NVarChar, team_name)
                .input("pn", sql.NVarChar, player_name)
                .input("r", sql.NVarChar, role || null)
                .input("p", sql.NVarChar, photo_url || null)
                .input("bs", sql.NVarChar, req.body.batting_style || null)
                .input("bows", sql.NVarChar, req.body.bowling_style || null)
                .query("INSERT INTO tournament_players (tournament_id, team_name, player_name, role, photo_url, batting_style, bowling_style) VALUES (@tid, @tn, @pn, @r, @p, @bs, @bows)");

            // 2. Auto-Sync to Player Profiles (Master Table)
            await pool.request()
                .input("pn", sql.NVarChar, player_name)
                .input("tn", sql.NVarChar, team_name)
                .input("r", sql.NVarChar, role || null)
                .input("p", sql.NVarChar, photo_url || null)
                .input("bs", sql.NVarChar, req.body.batting_style || null)
                .input("bows", sql.NVarChar, req.body.bowling_style || null)
                .query(`
                    IF EXISTS (SELECT 1 FROM player_profiles WHERE player_name = @pn)
                        UPDATE player_profiles SET team_name = @tn, role = @r, photo_url = COALESCE(@p, photo_url), batting_style = @bs, bowling_style = @bows, updated_at = GETDATE() WHERE player_name = @pn
                    ELSE
                        INSERT INTO player_profiles (player_name, team_name, role, photo_url, batting_style, bowling_style) VALUES (@pn, @tn, @r, @p, @bs, @bows)
                `);

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
                .input("bs", sql.NVarChar, req.body.batting_style || null)
                .input("bows", sql.NVarChar, req.body.bowling_style || null)
                .query("UPDATE tournament_players SET player_name = @npn, role = @r, batting_style = @bs, bowling_style = @bows WHERE tournament_id = @tid AND team_name = @tn AND player_name = @opn");

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
            .input("bs", sql.NVarChar, req.body.batting_style || null)
            .input("bows", sql.NVarChar, req.body.bowling_style || null)
            .query("INSERT INTO players (team_name, player_name, role, batting_style, bowling_style) VALUES (@t, @p, @r, @bs, @bows)");

        // Sync to profiles
        await pool.request()
            .input("pn", sql.NVarChar, player_name)
            .input("tn", sql.NVarChar, team_name)
            .input("r", sql.NVarChar, role || null)
            .input("bs", sql.NVarChar, req.body.batting_style || null)
            .input("bows", sql.NVarChar, req.body.bowling_style || null)
            .query(`
                IF EXISTS (SELECT 1 FROM player_profiles WHERE player_name = @pn)
                    UPDATE player_profiles SET team_name = @tn, role = @r, batting_style = @bs, bowling_style = @bows, updated_at = GETDATE() WHERE player_name = @pn
                ELSE
                    INSERT INTO player_profiles (player_name, team_name, role, batting_style, bowling_style) VALUES (@pn, @tn, @r, @bs, @bows)
            `);

        res.send("Player Added");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- PLAYER PROFILE MASTER ROUTES ---
app.get("/player-photo/:name", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const profiles = MEMORY_DB.player_profiles || [];
            const p = profiles.find(x => x.player_name === req.params.name);
            return res.json({ photo_url: p ? p.photo_url : null });
        }
        const r = await pool.request()
            .input("n", sql.NVarChar, req.params.name)
            .query("SELECT photo_url FROM player_profiles WHERE player_name = @n");
        res.json({ photo_url: r.recordset[0] ? r.recordset[0].photo_url : null });
    } catch (e) { res.json({ photo_url: null }); }
});

app.get("/player-role/:name", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const profiles = MEMORY_DB.player_profiles || [];
            const p = profiles.find(x => x.player_name === req.params.name);
            if (p) {
                let { role, batting_style, bowling_style } = p;
                if (!batting_style && !bowling_style) {
                    const tp = (MEMORY_DB.players || []).concat(MEMORY_DB.tournament_players || []).find(x => x.player_name === req.params.name && (x.batting_style || x.bowling_style));
                    if (tp) {
                        batting_style = tp.batting_style || null;
                        bowling_style = tp.bowling_style || null;
                        p.batting_style = batting_style;
                        p.bowling_style = bowling_style;
                        saveDB();
                    }
                }
                return res.json({ role, batting_style, bowling_style });
            } else {
                return res.json({ role: null });
            }
        }
        const r = await pool.request()
            .input("n", sql.NVarChar, req.params.name)
            .query("SELECT role, batting_style, bowling_style FROM player_profiles WHERE player_name = @n");
        if (r.recordset[0]) {
            let { role, batting_style, bowling_style } = r.recordset[0];
            // Fallback: if styles are null in player_profiles, check tournament_players
            if (!batting_style && !bowling_style) {
                const tp = await pool.request()
                    .input("n", sql.NVarChar, req.params.name)
                    .query("SELECT TOP 1 batting_style, bowling_style FROM tournament_players WHERE player_name = @n AND (batting_style IS NOT NULL OR bowling_style IS NOT NULL) ORDER BY id DESC");
                if (tp.recordset[0]) {
                    batting_style = tp.recordset[0].batting_style || null;
                    bowling_style = tp.recordset[0].bowling_style || null;
                    // Auto-sync back to player_profiles for future fetches
                    if (batting_style || bowling_style) {
                        await pool.request()
                            .input("n", sql.NVarChar, req.params.name)
                            .input("bs", sql.NVarChar, batting_style || null)
                            .input("bows", sql.NVarChar, bowling_style || null)
                            .query("UPDATE player_profiles SET batting_style = @bs, bowling_style = @bows WHERE player_name = @n");
                    }
                }
            }
            res.json({ role, batting_style, bowling_style });
        } else {
            res.json({ role: null });
        }
    } catch (e) { res.json({ role: null }); }
});

app.post("/player-profile", async (req, res) => {
    try {
        const { player_name, team_name, role, photo_url } = req.body;
        if (useJSON || !pool) {
            MEMORY_DB.player_profiles = MEMORY_DB.player_profiles || [];
            let p = MEMORY_DB.player_profiles.find(x => x.player_name === player_name);
            if (p) {
                p.team_name = team_name || p.team_name;
                p.role = role || p.role;
                p.photo_url = photo_url || p.photo_url;
                p.batting_style = req.body.batting_style || p.batting_style;
                p.bowling_style = req.body.bowling_style || p.bowling_style;
                p.updated_at = new Date();
            } else {
                MEMORY_DB.player_profiles.push({
                    player_name,
                    team_name: team_name || null,
                    role: role || null,
                    photo_url: photo_url || null,
                    batting_style: req.body.batting_style || null,
                    bowling_style: req.body.bowling_style || null,
                    created_at: new Date()
                });
            }
            saveDB();
            return res.json({ success: true });
        }

        await pool.request()
            .input("pn", sql.NVarChar, player_name)
            .input("r", sql.NVarChar, role || null)
            .input("p", sql.NVarChar, photo_url || null)
            .input("bs", sql.NVarChar, req.body.batting_style || null)
            .input("bows", sql.NVarChar, req.body.bowling_style || null)
            .query(`
                IF EXISTS (SELECT 1 FROM player_profiles WHERE player_name = @pn)
                    UPDATE player_profiles SET team_name = COALESCE(@tn, team_name), role = COALESCE(@r, role), photo_url = COALESCE(@p, photo_url), batting_style = @bs, bowling_style = @bows, updated_at = GETDATE() WHERE player_name = @pn
                ELSE
                    INSERT INTO player_profiles (player_name, team_name, role, photo_url, batting_style, bowling_style) VALUES (@pn, @tn, @r, @p, @bs, @bows)
            `);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/upload-photo", upload.single("photo"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file" });
        const b64 = req.file.buffer.toString("base64");
        const dataUri = "data:" + req.file.mimetype + ";base64," + b64;
        const uploadRes = await cloudinary.uploader.upload(dataUri, { folder: "player_photos" });

        const playerName = req.body.player_name;
        if (playerName && pool) {
            await pool.request()
                .input("pn", sql.NVarChar, playerName)
                .input("url", sql.NVarChar(sql.MAX), uploadRes.secure_url)
                .query(`
                    IF EXISTS (SELECT 1 FROM player_profiles WHERE player_name = @pn)
                        UPDATE player_profiles SET photo_url = @url, updated_at = GETDATE() WHERE player_name = @pn
                    ELSE
                        INSERT INTO player_profiles (player_name, photo_url) VALUES (@pn, @url)
                `);
        }
        res.json({ success: true, url: uploadRes.secure_url });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ success: false, error: err.message });
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

app.get("/match-results/:id", async (req, res) => {
    try {
        if (useJSON || !pool) {
            const match = MEMORY_DB.match_results.find(m => m.id == req.params.id);
            return res.json(match || null);
        }
        const r = await pool.request().input("id", sql.Int, req.params.id).query("SELECT * FROM match_results WHERE id=@id");
        res.json(r.recordset[0] || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/match-results", async (req, res) => {
    try {
        const {
            winner, loser, win_type, margin, played_on, organiser, commentary,
            match_id, t1_score, t2_score, t1_overs, t2_overs, t1_wickets, t2_wickets
        } = req.body;

        if (useJSON || !pool) {
            const id = Date.now();
            MEMORY_DB.match_results.push({
                id, winner, loser, win_type, margin, played_on, organiser, commentary,
                match_id, t1_score, t2_score, t1_overs, t2_overs, t1_wickets, t2_wickets,
                toss_info: req.body.toss_info
            });
            saveDB();
            return res.json({ id });
        }
        const r = await pool.request()
            .input("w", sql.NVarChar, winner || null)
            .input("l", sql.NVarChar, loser || null)
            .input("wt", sql.NVarChar, win_type || null)
            .input("m", sql.NVarChar, margin !== undefined && margin !== null ? margin.toString() : null)
            .input("p", sql.Date, played_on || null)
            .input("mid", sql.NVarChar, match_id !== undefined && match_id !== null ? match_id.toString() : null)
            .input("tid", sql.NVarChar, req.body.tournament_id !== undefined && req.body.tournament_id !== null ? req.body.tournament_id.toString() : null)
            .input("sn", sql.NVarChar, req.body.series_name || null)
            .input("t1n", sql.NVarChar, req.body.t1_name || null)
            .input("s1", sql.NVarChar, t1_score !== undefined && t1_score !== null ? t1_score.toString() : null)
            .input("o1", sql.NVarChar, t1_overs !== undefined && t1_overs !== null ? t1_overs.toString() : null)
            .input("w1", sql.Int, t1_wickets !== undefined ? t1_wickets : null)
            .input("t2n", sql.NVarChar, req.body.t2_name || null)
            .input("s2", sql.NVarChar, t2_score !== undefined && t2_score !== null ? t2_score.toString() : null)
            .input("o2", sql.NVarChar, t2_overs !== undefined && t2_overs !== null ? t2_overs.toString() : null)
            .input("w2", sql.Int, t2_wickets !== undefined ? t2_wickets : null)
            .input("org", sql.NVarChar, organiser || null)
            .input("com", sql.NVarChar(sql.MAX), commentary || null)
            .input("toss", sql.NVarChar, req.body.toss_info || null)
            .query(`INSERT INTO match_results (match_id, tournament_id, series_name, winner, loser, win_type, margin, played_on, t1_name, t1_score, t1_overs, t1_wickets, t2_name, t2_score, t2_overs, t2_wickets, organiser, commentary, toss_info) 
                    OUTPUT INSERTED.id 
                    VALUES (@mid, @tid, @sn, @w, @l, @wt, @m, @p, @t1n, @s1, @o1, @w1, @t2n, @s2, @o2, @w2, @org, @com, @toss)`);
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
            .input("mid", sql.NVarChar, match_id ? match_id.toString() : null)
            .input("inn", sql.Int, innings || 1)
            .input("ot", sql.NVarChar, req.body.opponent_team || null)
            .input("st", sql.NVarChar, shot_types ? (typeof shot_types === 'string' ? shot_types : JSON.stringify(shot_types)) : null)
            .input("ww", sql.NVarChar, wagon_wheel ? (typeof wagon_wheel === 'string' ? wagon_wheel : JSON.stringify(wagon_wheel)) : null)
            .query(`INSERT INTO player_stats (player_name, team_name, match_date, match_type, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, dismissal_type, dismissed_by, catches, run_outs, stumpings, match_id, innings, opponent_team, shot_types, wagon_wheel) 
                    OUTPUT INSERTED.id VALUES (@pn, @tn, @md, @mt, @r, @bf, @f4, @s6, @w, @ob, @rc, @dt, @db, @c, @ro, @s, @mid, @inn, @ot, @st, @ww)`);


        res.json({ success: true, id: r.recordset[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/player-stats", async (req, res) => {
    try {
        if (useJSON || !pool) {
            return res.json(MEMORY_DB.player_stats || []);
        }
        const r = await pool.request().query(`
            SELECT player_name,
                   SUM(runs) as runs,
                   SUM(wickets) as wickets,
                   COUNT(DISTINCT match_id) as matches
            FROM player_stats
            GROUP BY player_name
            ORDER BY SUM(runs) DESC
        `);
        res.json(r.recordset);
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

app.get("/player-match-history/:playerName", async (req, res) => {
    try {
        const { playerName } = req.params;
        if (useJSON || !pool) {
            const pStats = (MEMORY_DB.player_stats || []).filter(s => s.player_name === playerName);
            const grouped = {};
            pStats.forEach(row => {
                const mr = (MEMORY_DB.match_results || []).find(r => r.id == row.match_id || r.match_id == row.match_id);
                let tournamentName = "LEAGUE MATCH";
                if (mr && mr.tournament_id) {
                    const t = (MEMORY_DB.tournaments || []).find(x => x.id == mr.tournament_id);
                    if (t) tournamentName = t.name;
                }
                const mid = row.match_id || (mr ? mr.id : null) || ('legacy_' + (row.match_date || '') + (row.team_name || ''));
                if (!grouped[mid]) {
                    grouped[mid] = {
                        match_id: mid,
                        tournament_id: mr ? mr.tournament_id : null,
                        tournament_match_id: row.match_id,
                        tournament_name: tournamentName,
                        match_date: mr ? mr.played_on : row.match_date,
                        winner: mr ? mr.winner : null,
                        loser: mr ? mr.loser : null,
                        margin: mr ? mr.margin : null,
                        win_type: mr ? mr.win_type : null,
                        t1_name: mr ? (mr.t1_name || mr.winner || mr.loser) : null,
                        t1_score: mr ? mr.t1_score : null,
                        t1_overs: mr ? mr.t1_overs : null,
                        t1_wickets: mr ? mr.t1_wickets : null,
                        t2_name: mr ? (mr.t2_name || (mr.winner === mr.t1_name ? mr.loser : mr.winner)) : null,
                        t2_score: mr ? mr.t2_score : null,
                        t2_overs: mr ? mr.t2_overs : null,
                        t2_wickets: mr ? mr.t2_wickets : null,
                        player_stats: []
                    };
                }
                grouped[mid].player_stats.push({
                    match_type: row.match_type,
                    runs: row.runs,
                    balls_faced: row.balls_faced,
                    fours: row.fours,
                    sixes: row.sixes,
                    wickets: row.wickets,
                    overs_bowled: row.overs_bowled,
                    runs_conceded: row.runs_conceded,
                    innings: row.innings,
                    team_name: row.team_name,
                    catches: row.catches || 0,
                    run_outs: row.run_outs || 0,
                    stumpings: row.stumpings || 0
                });
            });
            return res.json(Object.values(grouped));
        }

        const result = await pool.request()
            .input("pn", sql.NVarChar, playerName)
            .query(`
                SELECT 
                    mr.*, mr.id as real_match_id,
                    ps.player_name, ps.match_type, ps.runs, ps.balls_faced, ps.fours, ps.sixes,
                    ps.wickets, ps.overs_bowled, ps.runs_conceded, ps.innings as player_innings,
                    ps.team_name as player_team,
                    ps.catches, ps.run_outs, ps.stumpings,
                    t.name as tournament_name
                FROM player_stats ps
                LEFT JOIN match_results mr ON ps.match_id = mr.id
                LEFT JOIN tournaments t ON mr.tournament_id = CAST(t.id AS NVARCHAR(100))
                WHERE ps.player_name = @pn
                ORDER BY ps.match_date DESC, ps.id DESC
            `);

        // Group by match_id to consolidate bat/bowl stats
        const grouped = {};
        result.recordset.forEach(row => {
            const mid = row.real_match_id || ('legacy_' + row.played_on + row.t1_name);
            if (!grouped[mid]) {
                grouped[mid] = {
                    match_id: row.real_match_id,
                    tournament_id: row.tournament_id,
                    tournament_match_id: row.match_id,
                    tournament_name: row.tournament_name || row.series_name || "LEAGUE MATCH",
                    match_date: row.played_on,
                    winner: row.winner,
                    loser: row.loser,
                    margin: row.margin,
                    win_type: row.win_type,
                    t1_name: row.t1_name,
                    t1_score: row.t1_score,
                    t1_overs: row.t1_overs,
                    t1_wickets: row.t1_wickets,
                    t2_name: row.t2_name,
                    t2_score: row.t2_score,
                    t2_overs: row.t2_overs,
                    t2_wickets: row.t2_wickets,
                    player_stats: []
                };
            }
            grouped[mid].player_stats.push({
                match_type: row.match_type,
                runs: row.runs,
                balls_faced: row.balls_faced,
                fours: row.fours,
                sixes: row.sixes,
                wickets: row.wickets,
                overs_bowled: row.overs_bowled,
                runs_conceded: row.runs_conceded,
                innings: row.player_innings,
                team_name: row.player_team,
                catches: row.catches || 0,
                run_outs: row.run_outs || 0,
                stumpings: row.stumpings || 0
            });
        });

        res.json(Object.values(grouped));
    } catch (err) {
        console.error("GET player-match-history error:", err);
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

// ================= PLAYER TEAMS =================
app.get("/player-teams/:player_name", async (req, res) => {
    try {
        const { player_name } = req.params;
        if (useJSON || !pool) {
            const players = MEMORY_DB.tournament_players || [];
            const teams = [...new Set(players.filter(p => p.player_name === player_name).map(p => p.team_name))];
            return res.json(teams.map(t => ({ team_name: t })));
        }
        const r = await pool.request()
            .input("pn", sql.NVarChar, player_name)
            .query("SELECT DISTINCT team_name FROM tournament_players WHERE player_name = @pn");
        res.json(r.recordset);
    } catch (err) {
        console.error("GET player-teams error:", err);
        res.status(500).json({ error: err.message });
    }
});






// ================= MY TOURNAMENTS (Player-based) =================
// Returns all tournaments where the logged-in user is a player (added to a team)
app.get("/my-tournaments/:username", async (req, res) => {
    try {
        const { username } = req.params;
        if (useJSON || !pool) {
            const tpList = MEMORY_DB.tournament_players || [];
            const tIds = [...new Set(tpList.filter(p => p.player_name.toLowerCase() === username.toLowerCase()).map(p => p.tournament_id))];
            const result = (MEMORY_DB.tournaments || []).filter(t => tIds.includes(t.id));
            const formatted = result.map(t => ({
                id: t.id,
                name: t.name,
                created_by: t.created_by,
                status: t.status,
                created_at: t.created_at,
                ball: t.ball_type || t.ball,
                startDate: t.start_date || t.startDate,
                endDate: t.end_date || t.endDate,
                logo: t.logo,
                city: t.city || null,
                ground: t.ground || null
            }));
            return res.json(formatted);
        }

        const result = await pool.request()
            .input("pn", sql.NVarChar, username)
            .query(`
                SELECT DISTINCT t.id, t.name, t.created_by, t.status, t.created_at,
                       t.ball_type AS ball,
                       t.start_date AS startDate,
                       t.end_date AS endDate,
                       t.logo, t.city, t.ground
                FROM tournament_players tp
                JOIN tournaments t ON tp.tournament_id = t.id
                WHERE LOWER(tp.player_name) = LOWER(@pn)
                ORDER BY t.id DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("GET my-tournaments error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ================= MY MATCHES (Player-based) =================
// Returns all matches where the logged-in player's team played
app.get("/my-matches/:username", async (req, res) => {
    try {
        const { username } = req.params;
        if (useJSON || !pool) {
            const tpList = MEMORY_DB.tournament_players || [];
            const userTeams = tpList.filter(p => p.player_name.toLowerCase() === username.toLowerCase());
            if (userTeams.length === 0) return res.json([]);

            let allMatches = [];
            for (const teamRow of userTeams) {
                const tName = (teamRow.team_name || '').toLowerCase();
                const tid = teamRow.tournament_id;
                const tournament = (MEMORY_DB.tournaments || []).find(t => t.id == tid);
                const tNameDisplay = tournament ? tournament.name : 'Tournament';

                const matches = (MEMORY_DB.tournament_matches || []).filter(m => 
                    m.tournament_id == tid &&
                    ((m.team1 || '').toLowerCase() === tName || (m.team2 || '').toLowerCase() === tName)
                );

                matches.forEach(m => {
                    const mr = (MEMORY_DB.match_results || []).find(r => r.id == m.id || r.match_id == m.id);
                    allMatches.push({
                        ...m,
                        t1_score: mr ? mr.t1_score : null,
                        t2_score: mr ? mr.t2_score : null,
                        t1_overs: mr ? mr.t1_overs : null,
                        t2_overs: mr ? mr.t2_overs : null,
                        result_winner: mr ? mr.winner : null,
                        tournament_name: tNameDisplay
                    });
                });
            }

            const seen = new Set();
            allMatches = allMatches.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });

            return res.json(allMatches);
        }

        // Step 1: Find all teams + tournaments the player belongs to
        const teamsResult = await pool.request()
            .input("pn", sql.NVarChar, username)
            .query(`
                SELECT DISTINCT tp.team_name, tp.tournament_id, tp.role,
                       t.name AS tournament_name
                FROM tournament_players tp
                LEFT JOIN tournaments t ON tp.tournament_id = t.id
                WHERE LOWER(tp.player_name) = LOWER(@pn)
            `);

        if (teamsResult.recordset.length === 0) return res.json([]);

        // Step 2: For each team, fetch matches that team played in
        let allMatches = [];
        for (const teamRow of teamsResult.recordset) {
            const matchesResult = await pool.request()
                .input("tid", sql.Int, teamRow.tournament_id)
                .input("tn", sql.NVarChar, teamRow.team_name)
                .query(`
                    SELECT tm.*,
                           mr.t1_score, mr.t2_score, mr.t1_overs, mr.t2_overs,
                           mr.winner AS result_winner
                    FROM tournament_matches tm
                    LEFT JOIN match_results mr ON CAST(tm.id AS NVARCHAR(100)) = mr.match_id
                    WHERE tm.tournament_id = @tid
                    AND (LOWER(tm.team1) = LOWER(@tn) OR LOWER(tm.team2) = LOWER(@tn))
                    ORDER BY tm.match_date ASC
                `);
            matchesResult.recordset.forEach(m => {
                allMatches.push({
                    ...m,
                    tournament_name: teamRow.tournament_name || 'Tournament'
                });
            });
        }

        // Remove duplicates (same match id)
        const seen = new Set();
        allMatches = allMatches.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });

        res.json(allMatches);
    } catch (err) {
        console.error("GET my-matches error:", err);
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
            const gallery = (MEMORY_DB.tournament_gallery || []).filter(g => g.tournament_id == tournament_id);
            res.json(gallery);
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
                } else {
                    MEMORY_DB.tournament_gallery = MEMORY_DB.tournament_gallery || [];
                    MEMORY_DB.tournament_gallery.push({
                        id: Date.now(),
                        tournament_id: parseInt(tournament_id),
                        photo_url: result.secure_url,
                        uploaded_by: uploaded_by || '',
                        caption: caption || '',
                        uploaded_at: new Date().toISOString()
                    });
                    saveDB();
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
        } else {
            MEMORY_DB.tournament_gallery = (MEMORY_DB.tournament_gallery || []).filter(g => g.id != id);
            saveDB();
        }
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE gallery error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ================= PLAYER PHOTOS =================
app.get("/player-photos/:playerName", async (req, res) => {
    try {
        const { playerName } = req.params;
        if (pool) {
            const r = await pool.request()
                .input('pName', sql.NVarChar, playerName)
                .query(`
                    SELECT DISTINCT tg.*, t.name as tournament_name
                    FROM tournament_gallery tg
                    JOIN tournaments t ON tg.tournament_id = t.id
                    WHERE tg.tournament_id IN (
                        SELECT DISTINCT tournament_id 
                        FROM tournament_players 
                        WHERE LOWER(player_name) = LOWER(@pName)
                    )
                    ORDER BY tg.uploaded_at DESC
                `);
            res.json(r.recordset);
        } else {
            const playerTournaments = (MEMORY_DB.tournament_players || [])
                .filter(tp => (tp.player_name || '').toLowerCase().trim() === playerName.toLowerCase().trim())
                .map(tp => parseInt(tp.tournament_id));
            const playerPhotos = (MEMORY_DB.tournament_gallery || [])
                .filter(tg => playerTournaments.includes(parseInt(tg.tournament_id)))
                .map(tg => {
                    const t = (MEMORY_DB.tournaments || []).find(x => x.id == tg.tournament_id);
                    return {
                        ...tg,
                        tournament_name: t ? t.name : 'Tournament'
                    };
                })
                .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
            res.json(playerPhotos);
        }
    } catch (err) {
        console.error("GET player-photos error:", err);
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
            .input("toss", sql.NVarChar, req.body.toss_info || null)
            .query(`
                INSERT INTO tournament_matches (tournament_id, team1, team2, match_date, match_time, result, status, toss_info)
                VALUES (@tid, @t1, @t2, @md, @mt, @res, @st, @toss)
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
        if (result === undefined && status === undefined && toss_info === undefined) {
            return res.json({ success: true, message: "Nothing to update" });
        }

        let updates = [];
        const request = pool.request().input("id", sql.Int, id);

        if (result !== undefined) { updates.push("result=@res"); request.input("res", sql.NVarChar, result); }
        if (status !== undefined) { updates.push("status=@st"); request.input("st", sql.NVarChar, status); }
        if (toss_info !== undefined) { updates.push("toss_info=@toss"); request.input("toss", sql.NVarChar, toss_info); }

        let query = "UPDATE tournament_matches SET " + updates.join(", ") + " WHERE id=@id";
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