const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Batting Table - add team tag after player name
content = content.replace(
  `<div style="flex:2; color:#0d9488; font-weight:600;">\${p}\${p === m.strike ? '*' : ''}</div>`,
  `<div style="flex:2; color:#0d9488; font-weight:600;">\${p}\${p === m.strike ? '*' : ''} <span style="font-size:10px; color:#9ca3af; font-weight:400;">(\${m.batTeam})</span></div>`
);

// 2. Bowling Table - add team tag after bowler name
content = content.replace(
  `<div style="flex:2; color:#0d9488; font-weight:600;">\${p}</div>\n          <div style="width:40px; text-align:center; color:#374151;">\${ov}</div>`,
  `<div style="flex:2; color:#0d9488; font-weight:600;">\${p} <span style="font-size:10px; color:#9ca3af; font-weight:400;">(\${m.bowlTeam})</span></div>\n          <div style="width:40px; text-align:center; color:#374151;">\${ov}</div>`
);

// 3. Teams Tab - Bat List add role/team indicator
content = content.replace(
  `teamsBatHtml += \`<li style="padding:12px 0; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; font-family:'Inter',sans-serif;">\${pAvatar} <span style="font-weight:500; color:#111827;">\${p}</span></li>\`;`,
  `teamsBatHtml += \`<li style="padding:12px 0; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; font-family:'Inter',sans-serif;">\${pAvatar} <div><span style="font-weight:500; color:#111827;">\${p}</span><br><span style="font-size:11px; color:#6b7280;">\${m.batTeam}</span></div></li>\`;`
);

// 4. Teams Tab - Bowl List
content = content.replace(
  `teamsBowlHtml += \`<li style="padding:12px 0; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; font-family:'Inter',sans-serif;">\${pAvatar} <span style="font-weight:500; color:#111827;">\${p}</span></li>\`;`,
  `teamsBowlHtml += \`<li style="padding:12px 0; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; font-family:'Inter',sans-serif;">\${pAvatar} <div><span style="font-weight:500; color:#111827;">\${p}</span><br><span style="font-size:11px; color:#6b7280;">\${m.bowlTeam}</span></div></li>\`;`
);

fs.writeFileSync('index.html', content);
console.log('Team name tags added!');
