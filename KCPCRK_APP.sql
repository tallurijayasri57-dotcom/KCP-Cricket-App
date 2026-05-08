-- ============================================================
--  KCP CRICKET APP - FRESH DATABASE SETUP
--  Tournament-Scoped Teams & Players Schema
--  Step 1: Drop existing tables (clean slate)
--  Step 2: Create fresh tables — teams & players scoped to tournaments
-- ============================================================

-- 1. DATABASE CREATION
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'cricket_db')
BEGIN
    CREATE DATABASE cricket_db;
END
GO

USE cricket_db;
GO

-- ============================================================
-- STEP 1: DROP ALL EXISTING TABLES
-- ============================================================

-- Drop in correct order (child tables first, then parent)
IF OBJECT_ID('dbo.player_stats',       'U') IS NOT NULL DROP TABLE dbo.player_stats;
IF OBJECT_ID('dbo.player_profile',     'U') IS NOT NULL DROP TABLE dbo.player_profile;
IF OBJECT_ID('dbo.points_table',       'U') IS NOT NULL DROP TABLE dbo.points_table;
IF OBJECT_ID('dbo.live_matches',       'U') IS NOT NULL DROP TABLE dbo.live_matches;
IF OBJECT_ID('dbo.match_results',      'U') IS NOT NULL DROP TABLE dbo.match_results;
IF OBJECT_ID('dbo.upcoming_matches',   'U') IS NOT NULL DROP TABLE dbo.upcoming_matches;
IF OBJECT_ID('dbo.tournament_players', 'U') IS NOT NULL DROP TABLE dbo.tournament_players;
IF OBJECT_ID('dbo.tournament_teams',   'U') IS NOT NULL DROP TABLE dbo.tournament_teams;
IF OBJECT_ID('dbo.players',            'U') IS NOT NULL DROP TABLE dbo.players;
IF OBJECT_ID('dbo.teams',              'U') IS NOT NULL DROP TABLE dbo.teams;
IF OBJECT_ID('dbo.tournaments',        'U') IS NOT NULL DROP TABLE dbo.tournaments;
IF OBJECT_ID('dbo.users',              'U') IS NOT NULL DROP TABLE dbo.users;
GO

PRINT '✅ All old tables dropped successfully.';
GO

-- ============================================================
-- STEP 2: CREATE FRESH TABLES
-- ============================================================

-- ------------------------------------------------------------
-- PAGE 1: LOGIN / REGISTER PAGE
-- Table: users
-- ------------------------------------------------------------
CREATE TABLE dbo.users (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    username    NVARCHAR(100) NOT NULL UNIQUE,
    password    NVARCHAR(255) NOT NULL,
    created_at  DATETIME DEFAULT GETDATE()
);
PRINT '✅ Table [users] created.';
GO

-- ------------------------------------------------------------
-- PAGE 2: TOURNAMENTS PAGE
-- Table: tournaments  ← Now has proper columns (no JSON blob)
-- ------------------------------------------------------------
CREATE TABLE dbo.tournaments (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         NVARCHAR(100) NOT NULL,      -- which user created this tournament
    name            NVARCHAR(200) NOT NULL,      -- tournament name
    format          NVARCHAR(50)  DEFAULT 'T20', -- T20 / ODI / Test
    overs           INT           DEFAULT 20,
    tournament_data NVARCHAR(MAX) NULL,          -- JSON blob for extra settings (optional)
    created_at      DATETIME DEFAULT GETDATE(),
    updated_at      DATETIME DEFAULT GETDATE()
);
PRINT '✅ Table [tournaments] created.';
GO

-- ------------------------------------------------------------
-- PAGE 3: TEAMS PAGE (Tournament-Scoped)
-- Table: tournament_teams  ← Teams belong to a specific tournament
-- ------------------------------------------------------------
CREATE TABLE dbo.tournament_teams (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id   INT           NOT NULL,       -- FK → tournaments.id
    team_name       NVARCHAR(100) NOT NULL,
    created_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_TTeams_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE CASCADE
);
PRINT '✅ Table [tournament_teams] created.';
GO

-- ------------------------------------------------------------
-- PAGE 4: PLAYERS PAGE (Tournament-Scoped)
-- Table: tournament_players  ← Players belong to a tournament team
-- ------------------------------------------------------------
CREATE TABLE dbo.tournament_players (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id   INT           NOT NULL,       -- FK → tournaments.id
    team_id         INT           NOT NULL,       -- FK → tournament_teams.id
    team_name       NVARCHAR(100) NOT NULL,       -- denormalized for quick lookup
    player_name     NVARCHAR(100) NOT NULL,
    role            NVARCHAR(50)  NULL,           -- Batsman / Bowler / All-Rounder / WK
    photo_url       NVARCHAR(MAX) NULL,
    created_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_TPlayers_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE CASCADE,
    CONSTRAINT FK_TPlayers_Team FOREIGN KEY (team_id)
        REFERENCES dbo.tournament_teams(id)
);
PRINT '✅ Table [tournament_players] created.';
GO

-- ------------------------------------------------------------
-- PAGE 5: MATCH RESULTS PAGE (Tournament-Scoped)
-- Table: match_results
-- ------------------------------------------------------------
CREATE TABLE dbo.match_results (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id   INT           NULL,           -- FK → tournaments.id (optional for backward compat)
    winner          NVARCHAR(100) NOT NULL,
    loser           NVARCHAR(100) NOT NULL,
    win_type        NVARCHAR(50)  NULL,           -- 'runs' or 'wickets'
    margin          NVARCHAR(50)  NULL,           -- e.g. '5 wickets' or '20 runs'
    played_on       NVARCHAR(100) NULL,
    created_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_MatchResults_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE SET NULL
);
PRINT '✅ Table [match_results] created.';
GO

-- ------------------------------------------------------------
-- PAGE 6: UPCOMING MATCHES PAGE (Tournament-Scoped)
-- Table: upcoming_matches
-- ------------------------------------------------------------
CREATE TABLE dbo.upcoming_matches (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id   INT           NULL,           -- FK → tournaments.id
    team1           NVARCHAR(100) NOT NULL,
    team2           NVARCHAR(100) NOT NULL,
    match_date      DATE          NOT NULL,
    created_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_UpcomingMatches_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE SET NULL
);
PRINT '✅ Table [upcoming_matches] created.';
GO

-- ------------------------------------------------------------
-- PAGE 7: LIVE MATCHES PAGE
-- Table: live_matches  (tournament-agnostic — match_state JSON has all details)
-- ------------------------------------------------------------
CREATE TABLE dbo.live_matches (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    match_id        NVARCHAR(100) NOT NULL UNIQUE,
    tournament_id   INT           NULL,
    match_state     NVARCHAR(MAX) NOT NULL,       -- Full match state as JSON
    updated_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_LiveMatches_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE SET NULL
);
PRINT '✅ Table [live_matches] created.';
GO

-- ------------------------------------------------------------
-- PAGE 8: PLAYER STATS PAGE (Tournament-Scoped)
-- Table: player_stats
-- ------------------------------------------------------------
CREATE TABLE dbo.player_stats (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id   INT           NULL,
    player_name     NVARCHAR(100) NOT NULL,
    team_name       NVARCHAR(100) NULL,
    match_date      DATE          NULL,
    match_type      NVARCHAR(50)  NOT NULL,       -- T20 / ODI / Test
    runs            INT           DEFAULT 0,
    balls_faced     INT           DEFAULT 0,
    fours           INT           DEFAULT 0,
    sixes           INT           DEFAULT 0,
    strike_rate     FLOAT         DEFAULT 0,
    wickets         INT           DEFAULT 0,
    overs_bowled    NVARCHAR(10)  DEFAULT '0.0',
    runs_conceded   INT           DEFAULT 0,
    dismissal_type  NVARCHAR(50)  NULL,           -- Caught / LBW / Bowled etc.
    dismissed_by    NVARCHAR(100) NULL,
    catches         INT           DEFAULT 0,
    run_outs        INT           DEFAULT 0,
    stumpings       INT           DEFAULT 0,
    match_id        INT           NULL,
    innings         INT           DEFAULT 1,
    shot_types      NVARCHAR(MAX) NULL,           -- JSON
    wagon_wheel     NVARCHAR(MAX) NULL,           -- JSON
    created_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_PlayerStats_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE SET NULL
);
PRINT '✅ Table [player_stats] created.';
GO

-- ------------------------------------------------------------
-- PAGE 9: PLAYER PROFILE PAGE
-- Table: player_profile  (global — not tournament-scoped)
-- ------------------------------------------------------------
CREATE TABLE dbo.player_profile (
    player_id       INT IDENTITY(1,1) PRIMARY KEY,
    player_name     NVARCHAR(100) NOT NULL,
    team_name       NVARCHAR(100) NULL,
    runs            INT           DEFAULT 0,
    role            NVARCHAR(50)  NULL,           -- Batsman / Bowler / All-Rounder / WK
    photo_url       NVARCHAR(MAX) NULL,
    created_at      DATETIME DEFAULT GETDATE()
);
PRINT '✅ Table [player_profile] created.';
GO

-- ------------------------------------------------------------
-- PAGE 10: POINTS TABLE PAGE (Tournament-Scoped)
-- Table: points_table
-- ------------------------------------------------------------
CREATE TABLE dbo.points_table (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id   INT           NULL,
    team_name       NVARCHAR(100) NOT NULL,
    matches_played  INT           DEFAULT 0,
    wins            INT           DEFAULT 0,
    losses          INT           DEFAULT 0,
    points          INT           DEFAULT 0,
    runs_scored     FLOAT         DEFAULT 0,
    runs_conceded   FLOAT         DEFAULT 0,
    overs_faced     FLOAT         DEFAULT 0,
    overs_bowled    FLOAT         DEFAULT 0,
    net_run_rate    FLOAT         DEFAULT 0,
    updated_at      DATETIME DEFAULT GETDATE(),

    CONSTRAINT UQ_PointsTable_TournTeam UNIQUE (tournament_id, team_name),
    CONSTRAINT FK_PointsTable_Tournament FOREIGN KEY (tournament_id)
        REFERENCES dbo.tournaments(id) ON DELETE SET NULL
);
PRINT '✅ Table [points_table] created.';
GO

-- ============================================================
-- FINAL CHECK: Show all created tables
-- ============================================================
SELECT
    TABLE_NAME      AS [Table Name],
    TABLE_SCHEMA    AS [Schema]
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
GO

PRINT '🎉 KCP Cricket DB setup complete! All tables are ready.';
GO