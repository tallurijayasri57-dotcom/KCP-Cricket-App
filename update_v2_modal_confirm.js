const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// The lines in the file are exactly:
//       let name = document.getElementById('addTeamPlayerNameInput').value.trim();
//       if (!name) { alert('Enter player name'); return; }
//       let role = document.getElementById('addTeamPlayerRoleInput').value;
//       let batStyle = document.getElementById('addTeamPlayerBattingStyleInput').value;
//       let bowlStyle = document.getElementById('addTeamPlayerBowlingStyleInput').value;
//       if (!role) { alert('Select player role'); return; }

content = content.replace(
  "      let name = document.getElementById('addTeamPlayerNameInput').value.trim();\n" +
  "      if (!name) { alert('Enter player name'); return; }\n" +
  "      let role = document.getElementById('addTeamPlayerRoleInput').value;\n" +
  "      let batStyle = document.getElementById('addTeamPlayerBattingStyleInput').value;\n" +
  "      let bowlStyle = document.getElementById('addTeamPlayerBowlingStyleInput').value;\n" +
  "      if (!role) { alert('Select player role'); return; }",
  "      let name = document.getElementById('addTeamPlayerNameInput').value.trim();\n" +
  "      let role = document.getElementById('addTeamPlayerRoleInput').value;\n" +
  "      let batStyle = document.getElementById('addTeamPlayerBattingStyleInput').value;\n" +
  "      let bowlStyle = document.getElementById('addTeamPlayerBowlingStyleInput').value;\n" +
  "      if (!name) { alert('Enter player name'); return; }\n" +
  "      if (!role) { alert('Select player role'); return; }\n" +
  "      if (role === 'Batsman' && !batStyle) { alert('Select Batting Style'); return; }\n" +
  "      if (role === 'Bowler' && !bowlStyle) { alert('Select Bowling Style'); return; }\n" +
  "      if ((role === 'All-Rounder' || role === 'Wicket-Keeper') && (!batStyle || !bowlStyle)) {\n" +
  "        alert('Select both Batting and Bowling Styles');\n" +
  "        return;\n" +
  "      }"
);

// Second replace:
content = content.replace(
  "      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';\n\n      showPlayerAddedToast(tName);",
  "      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';\n\n      let currentCount = document.getElementById('editTeamPlayersList') ? document.getElementById('editTeamPlayersList').children.length : 0;\n      showPlayerAddedToast(tName, currentCount + 1);"
);

// Just in case it has carriage returns:
content = content.replace(
  "      let name = document.getElementById('addTeamPlayerNameInput').value.trim();\r\n      if (!name) { alert('Enter player name'); return; }\r\n      let role = document.getElementById('addTeamPlayerRoleInput').value;\r\n      let batStyle = document.getElementById('addTeamPlayerBattingStyleInput').value;\r\n      let bowlStyle = document.getElementById('addTeamPlayerBowlingStyleInput').value;\r\n      if (!role) { alert('Select player role'); return; }",
  "      let name = document.getElementById('addTeamPlayerNameInput').value.trim();\r\n      let role = document.getElementById('addTeamPlayerRoleInput').value;\r\n      let batStyle = document.getElementById('addTeamPlayerBattingStyleInput').value;\r\n      let bowlStyle = document.getElementById('addTeamPlayerBowlingStyleInput').value;\r\n      if (!name) { alert('Enter player name'); return; }\r\n      if (!role) { alert('Select player role'); return; }\r\n      if (role === 'Batsman' && !batStyle) { alert('Select Batting Style'); return; }\r\n      if (role === 'Bowler' && !bowlStyle) { alert('Select Bowling Style'); return; }\r\n      if ((role === 'All-Rounder' || role === 'Wicket-Keeper') && (!batStyle || !bowlStyle)) {\r\n        alert('Select both Batting and Bowling Styles');\r\n        return;\r\n      }"
);

content = content.replace(
  "      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';\r\n\r\n      showPlayerAddedToast(tName);",
  "      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';\r\n\r\n      let currentCount = document.getElementById('editTeamPlayersList') ? document.getElementById('editTeamPlayersList').children.length : 0;\r\n      showPlayerAddedToast(tName, currentCount + 1);"
);

fs.writeFileSync('index.html', content);
console.log('Update finished!');
