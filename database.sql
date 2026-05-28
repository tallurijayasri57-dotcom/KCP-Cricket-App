USE cricket_db;
GO


CREATE TABLE users (
    user_id           INT IDENTITY(1,1) PRIMARY KEY,
    username          NVARCHAR(100) NOT NULL UNIQUE,
    password          NVARCHAR(255) NOT NULL,
    photo_url         NVARCHAR(MAX) NULL,
    created_at        DATETIME DEFAULT GETDATE(),
    phone_number      NVARCHAR(20)  NULL,
    display_name      NVARCHAR(200) NULL,
    security_question NVARCHAR(MAX) NULL,
    security_answer   NVARCHAR(MAX) NULL
);
GO

CREATE TABLE tournaments (
    tournament_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    created_by NVARCHAR(100) NOT NULL,
    ball_type NVARCHAR(50) NULL,  
    start_date DATE NULL,
    end_date DATE NULL,
    status NVARCHAR(50) DEFAULT 'Ongoing',
    created_at DATETIME DEFAULT GETDATE(),
    logo NVARCHAR(MAX) NULL,
    organiser NVARCHAR(200) NULL,
    city NVARCHAR(200) NULL,
    ground NVARCHAR(200) NULL
);
GO

CREATE TABLE tournament_teams (
    team_id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    team_name NVARCHAR(100) NOT NULL,
    city NVARCHAR(100) NULL,
    logo NVARCHAR(MAX) NULL,
    captain NVARCHAR(150) NULL,
    CONSTRAINT FK_TournTeams_Tourn FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE
);
GO

CREATE TABLE tournament_players (
    player_id     INT IDENTITY(1,1) PRIMARY KEY,  
    user_id       INT           NULL,              
    team_id       INT           NULL,              
    tournament_id INT           NOT NULL,          
    team_name     NVARCHAR(100) NULL,
    player_name   NVARCHAR(150) NULL,
    role          NVARCHAR(100) NULL,
    photo_url     NVARCHAR(MAX) NULL,
    batting_style NVARCHAR(50)  NULL,
    bowling_style NVARCHAR(50)  NULL,
    CONSTRAINT FK_TournPlayers_Tourn FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    CONSTRAINT FK_TournPlayers_User  FOREIGN KEY (user_id)       REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT FK_TournPlayers_Team  FOREIGN KEY (team_id)       REFERENCES tournament_teams(team_id)
);
GO

CREATE TABLE tournament_gallery (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    photo_url NVARCHAR(MAX) NOT NULL,
    uploaded_by NVARCHAR(150),
    uploaded_at DATETIME DEFAULT GETDATE(),
	caption NVARCHAR(MAX) NULL,
    CONSTRAINT FK_TG_Tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE
);
GO

CREATE TABLE tournament_matches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    team1 NVARCHAR(150) NOT NULL,
    team2 NVARCHAR(150) NOT NULL,
    match_date DATE,
    match_time NVARCHAR(50),
    result NVARCHAR(255),
    toss_info NVARCHAR(255),
    status NVARCHAR(50) DEFAULT 'upcoming',
    created_at DATETIME DEFAULT GETDATE(),
    t1_id INT NULL,
    t2_id INT NULL,
    CONSTRAINT FK_TM_Tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[player_stats]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[player_stats](
        [id] [int] IDENTITY(1,1) PRIMARY KEY,
        [player_name] [nvarchar](255) NOT NULL,
        [team_name] [nvarchar](255) NULL,
        [match_date] [date] NULL,
        [match_type] [nvarchar](50) NULL,
        [runs] [int] DEFAULT 0,
        [balls_faced] [int] DEFAULT 0,
        [fours] [int] DEFAULT 0,
        [sixes] [int] DEFAULT 0,
        [wickets] [int] DEFAULT 0,
        [overs_bowled] [nvarchar](50) DEFAULT '0.0',
        [runs_conceded] [int] DEFAULT 0,
		[strike_rate] [float] NULL,
        [catches] [int] DEFAULT 0,
        [run_outs] [int] DEFAULT 0,
        [stumpings] [int] DEFAULT 0,
        [dismissal_type] [nvarchar](100) NULL,
        [dismissed_by] [nvarchar](255) NULL,
        [match_id] [nvarchar](100) NULL,
        [innings] [int] DEFAULT 1,
        [shot_types] [nvarchar](max) NULL,
        [wagon_wheel] [nvarchar](max) NULL,
        [tournament_id] [nvarchar](100) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[match_results]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[match_results](
        [id] [int] IDENTITY(1,1) PRIMARY KEY,
        [winner] [nvarchar](100) NULL,
        [loser] [nvarchar](100) NULL,
        [win_type] [nvarchar](50) NULL,
        [margin] [nvarchar](100) NULL,
        [played_on] [nvarchar](50) NULL,
        [organiser] [nvarchar](100) NULL,
        [commentary] [nvarchar](max) NULL,
        [t1_score] [int] NULL,
        [t2_score] [int] NULL,
        [t1_overs] [decimal](4,1) NULL,
        [t2_overs] [decimal](4,1) NULL,
        [match_id] [nvarchar](100) NULL,
        [tournament_id] [nvarchar](100) NULL,
        [series_name] [nvarchar](200) NULL,
        [t1_name] [nvarchar](100) NULL,
        [t2_name] [nvarchar](100) NULL,
        [t1_wickets] [int] NULL,
        [t2_wickets] [int] NULL,
        [toss_info] [nvarchar](max) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[player_profiles]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[player_profiles](
        [player_name] [nvarchar](255) PRIMARY KEY,
        [team_name] [nvarchar](255) NULL,
        [role] [nvarchar](100) NULL,
        [photo_url] [nvarchar](max) NULL,
        [updated_at] [datetime] DEFAULT GETDATE(),
        [batting_style] [nvarchar](50) NULL,
        [bowling_style] [nvarchar](50) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[live_matches]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[live_matches](
        [id] [int] IDENTITY(1,1) PRIMARY KEY,
        [match_id] [nvarchar](100) UNIQUE NOT NULL,
        [match_state] [nvarchar](max) NOT NULL,    -- Full JSON data for re-rendering graphs
        [updated_at] [datetime] DEFAULT GETDATE()
    );
END
GO

CREATE TABLE points_table (
    team_name NVARCHAR(150) PRIMARY KEY,
    matches_played INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    points INT DEFAULT 0,
    runs_scored FLOAT DEFAULT 0.0,
    runs_conceded FLOAT DEFAULT 0.0,
    overs_faced FLOAT DEFAULT 0.0,
    overs_bowled FLOAT DEFAULT 0.0,
    net_run_rate FLOAT DEFAULT 0.0
);
GO

SELECT * FROM users;
SELECT * FROM tournaments;
SELECT * FROM tournament_teams;
SELECT * FROM tournament_players;
SELECT * FROM tournament_matches;
SELECT * FROM tournament_gallery;
SELECT * FROM match_results;
SELECT * FROM player_stats;
SELECT * FROM player_profiles;
SELECT * FROM live_matches;
SELECT * FROM points_table;

select a.player_id, a.player_name, a.team_name, a.role from tournament_players a, player_profiles b
where a.team_name = b.team_name
  and a.player_name = b.player_name
  and a.team_name = 'SRH';
