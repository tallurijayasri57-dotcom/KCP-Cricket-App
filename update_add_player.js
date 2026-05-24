const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Add handleRoleChange function for modal
const handleRoleChangeStr = `
    function handleAddPlayerRoleChange() {
      const role = document.getElementById('addPlayerRoleInput').value;
      const batStyle = document.getElementById('addPlayerBattingStyleInput');
      const bowlStyle = document.getElementById('addPlayerBowlingStyleInput');

      // Reset styles
      batStyle.disabled = false;
      bowlStyle.disabled = false;
      batStyle.style.opacity = '1';
      bowlStyle.style.opacity = '1';
      batStyle.style.transform = 'scale(1)';
      bowlStyle.style.transform = 'scale(1)';
      batStyle.style.transition = 'all 0.3s ease';
      bowlStyle.style.transition = 'all 0.3s ease';
      batStyle.style.border = '1px solid #d1d5db';
      bowlStyle.style.border = '1px solid #d1d5db';
      batStyle.style.boxShadow = 'none';
      bowlStyle.style.boxShadow = 'none';

      if (role === 'Batsman') {
        bowlStyle.disabled = true;
        bowlStyle.style.opacity = '0.5';
        bowlStyle.value = '';
        
        batStyle.style.transform = 'scale(1.05)';
        batStyle.style.border = '2px solid #10b981';
        batStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
      } else if (role === 'Bowler') {
        batStyle.disabled = true;
        batStyle.style.opacity = '0.5';
        batStyle.value = '';
        
        bowlStyle.style.transform = 'scale(1.05)';
        bowlStyle.style.border = '2px solid #10b981';
        bowlStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
      } else if (role === 'All-Rounder' || role === 'Wicket-Keeper') {
        batStyle.style.transform = 'scale(1.05)';
        batStyle.style.border = '2px solid #10b981';
        batStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
        
        bowlStyle.style.transform = 'scale(1.05)';
        bowlStyle.style.border = '2px solid #10b981';
        bowlStyle.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
      }
    }
`;

// Insert the new function before closeAddPlayerModal
content = content.replace(
  '    function closeAddPlayerModal() {',
  handleRoleChangeStr + '\n    function closeAddPlayerModal() {'
);

// 2. Add onchange to the select in HTML
content = content.replace(
  '<select class="add-player-modal-select" id="addPlayerRoleInput" style="margin-bottom:16px;">',
  '<select class="add-player-modal-select" id="addPlayerRoleInput" style="margin-bottom:16px;" onchange="handleAddPlayerRoleChange()">'
);

// 3. Reset state when opening modal
content = content.replace(
  `      document.getElementById('addPlayerRoleInput').value = '';
      document.getElementById('addPlayerModalOverlay').classList.add('open');`,
  `      document.getElementById('addPlayerRoleInput').value = '';
      document.getElementById('addPlayerBattingStyleInput').value = '';
      document.getElementById('addPlayerBowlingStyleInput').value = '';
      if(typeof handleAddPlayerRoleChange === 'function') handleAddPlayerRoleChange();
      document.getElementById('addPlayerModalOverlay').classList.add('open');`
);

// 4. Update confirm validation
const validationStr = `
      if (!pname) { alert('Enter player name'); return; }
      if (!role) { alert('Select a role'); return; }
      if (role === 'Batsman' && !batStyle) { alert('Select Batting Style'); return; }
      if (role === 'Bowler' && !bowlStyle) { alert('Select Bowling Style'); return; }
      if ((role === 'All-Rounder' || role === 'Wicket-Keeper') && (!batStyle || !bowlStyle)) {
        alert('Select both Batting and Bowling Styles');
        return;
      }
`;
content = content.replace(
  `      if (!pname) { alert('Enter player name'); return; }
      if (!role) { alert('Select a role'); return; }`,
  validationStr
);

// 5. Update toast call in confirmAddPlayerModal
content = content.replace(
  `      closeAddPlayerModal();
      renderMtTeams();
    }`,
  `      closeAddPlayerModal();
      renderMtTeams();
      showPlayerAddedToast(teamName, t.teams[addPlayerTargetTeamIdx].players.length);
    }`
);

// 6. Modify showPlayerAddedToast
const newToastFunc = `
    function showPlayerAddedToast(teamName, count) {
      if (!document.getElementById('_shrinkKf')) {
        let s = document.createElement('style');
        s.id = '_shrinkKf';
        s.textContent = '@keyframes shrinkProgress { from { width:100%; } to { width:0%; } }';
        document.head.appendChild(s);
      }
      let toast = document.getElementById('playerAddedToast');
      let textEl = toast.querySelector('span[style*="flex:1"]');
      let suffix = 'th';
      if (count % 10 === 1 && count % 100 !== 11) suffix = 'st';
      else if (count % 10 === 2 && count % 100 !== 12) suffix = 'nd';
      else if (count % 10 === 3 && count % 100 !== 13) suffix = 'rd';
      let msg = count ? count + suffix + ' player added to ' + (teamName || 'team') : 'Player added to ' + (teamName || 'team');
      if (textEl) textEl.innerText = msg;
      let bar = toast.querySelector('div[style*="height:3px"]');
      if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = 'shrinkProgress 3s linear forwards'; }
      toast.style.display = 'flex';
      setTimeout(function () { toast.style.display = 'none'; }, 3000);
    }
`;

content = content.replace(
  /function showPlayerAddedToast\(teamName\) \{[\s\S]*?setTimeout\(function \(\) \{ toast\.style\.display = 'none'; \}, 3000\);\s*\}/,
  newToastFunc.trim()
);

fs.writeFileSync('index.html', content);
console.log('Role validation and toasts updated!');
