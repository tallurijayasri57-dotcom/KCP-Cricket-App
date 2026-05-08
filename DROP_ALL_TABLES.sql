USE cricket_db;
GO

-- Drop all tables (child tables first, then parent)
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

PRINT 'All tables dropped successfully.';
