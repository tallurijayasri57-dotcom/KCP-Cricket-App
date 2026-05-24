const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Add handleRoleChange function for Team Player Modal
const handleTeamPlayerRoleChangeStr = `
    function handleTeamPlayerRoleChange() {
      const role = document.getElementById('addTeamPlayerRoleInput').value;
      const batStyle = document.getElementById('addTeamPlayerBattingStyleInput');
      const bowlStyle = document.getElementById('addTeamPlayerBowlingStyleInput');

      // Reset styles
      batStyle.disabled = false;
      bowlStyle.disabled = false;
      batStyle.style.opacity = '1';
      bowlStyle.style.opacity = '1';
      batStyle.style.transform = 'scale(1)';
      bowlStyle.style.transform = 'scale(1)';
      batStyle.style.transition = 'all 0.3s ease';
      bowlStyle.style.transition = 'all 0.3s ease';
      batStyle.style.border = 'none';
      batStyle.style.borderBottom = '1px solid #d1d5db';
      bowlStyle.style.border = 'none';
      bowlStyle.style.borderBottom = '1px solid #d1d5db';
      batStyle.style.boxShadow = 'none';
      bowlStyle.style.boxShadow = 'none';

      if (role === 'Batsman') {
        bowlStyle.disabled = true;
        bowlStyle.style.opacity = '0.5';
        bowlStyle.value = '';
        
        batStyle.style.transform = 'scale(1.05)';
        batStyle.style.border = '2px solid #10b981';
        batStyle.style.borderRadius = '4px';
        batStyle.style.padding = '8px';
        batStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
      } else if (role === 'Bowler') {
        batStyle.disabled = true;
        batStyle.style.opacity = '0.5';
        batStyle.value = '';
        
        bowlStyle.style.transform = 'scale(1.05)';
        bowlStyle.style.border = '2px solid #10b981';
        bowlStyle.style.borderRadius = '4px';
        bowlStyle.style.padding = '8px';
        bowlStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
      } else if (role === 'All-Rounder' || role === 'Wicket-Keeper') {
        batStyle.style.transform = 'scale(1.05)';
        batStyle.style.border = '2px solid #10b981';
        batStyle.style.borderRadius = '4px';
        batStyle.style.padding = '8px';
        batStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
        
        bowlStyle.style.transform = 'scale(1.05)';
        bowlStyle.style.border = '2px solid #10b981';
        bowlStyle.style.borderRadius = '4px';
        bowlStyle.style.padding = '8px';
        bowlStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
      }
    }
`;

content = content.replace(
  '    async function confirmAddTeamPlayer() {',
  handleTeamPlayerRoleChangeStr + '\n    async function confirmAddTeamPlayer() {'
);

// 2. Add onchange to select
content = content.replace(
  '<select id="addTeamPlayerRoleInput"',
  '<select id="addTeamPlayerRoleInput" onchange="handleTeamPlayerRoleChange()"'
);

// 3. Reset state when opening modal
content = content.replace(
  `      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';

      document.getElementById('addTeamPlayerModal').style.display = 'flex';`,
  `      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';
      if(typeof handleTeamPlayerRoleChange === 'function') handleTeamPlayerRoleChange();
      document.getElementById('addTeamPlayerModal').style.display = 'flex';`
);

content = content.replace(
  `      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';

    document.getElementById('addTeamPlayerModal').style.display = 'flex';`,
  `      document.getElementById('addTeamPlayerBowlingStyleInput').value = '';
    if(typeof handleTeamPlayerRoleChange === 'function') handleTeamPlayerRoleChange();
    document.getElementById('addTeamPlayerModal').style.display = 'flex';`
);

// 4. Update validation in confirmAddTeamPlayer
const validationStr = `
      if (!name) { alert('Enter player name'); return; }
      if (!role) { alert('Select a role'); return; }
      if (role === 'Batsman' && !batStyle) { alert('Select Batting Style'); return; }
      if (role === 'Bowler' && !bowlStyle) { alert('Select Bowling Style'); return; }
      if ((role === 'All-Rounder' || role === 'Wicket-Keeper') && (!batStyle || !bowlStyle)) {
        alert('Select both Batting and Bowling Styles');
        return;
      }
`;
content = content.replace(
  `      if (!name) { alert("Enter player name"); return; }
      if (!role) { alert("Select a role"); return; }`,
  validationStr
);

fs.writeFileSync('index.html', content);
console.log('Done mapping to v2.0 modal');
