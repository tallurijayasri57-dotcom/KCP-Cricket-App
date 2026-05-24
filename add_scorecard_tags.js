const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Add bowlTeam param to renderInnings function definition
content = content.replace(
  'function renderInnings(inn, title, isOpen = false) {',
  'function renderInnings(inn, title, isOpen = false, bowlTeam = "") {'
);

// 2. Batsman name cell - add team tag
content = content.replace(
  `<div class="player-name-truncate" style="color:#f8fafc; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${b.name}</div><div style="font-size:11px; color:#94a3b8; margin-top:2px; line-height:1.2; word-wrap:break-word; white-space:normal;">\${b.outDesc || 'not out'}</div>`,
  `<div class="player-name-truncate" style="color:#f8fafc; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${b.name} <span style="font-size:10px; color:#64748b; font-weight:400;">(\${inn.batTeam || ''})</span></div><div style="font-size:11px; color:#94a3b8; margin-top:2px; line-height:1.2; word-wrap:break-word; white-space:normal;">\${b.outDesc || 'not out'}</div>`
);

// 3. Bowler name cell - add team tag
content = content.replace(
  `<div class="player-name-truncate" style="color:#f8fafc; font-weight:600;">\${b.name}</div></td>`,
  `<div class="player-name-truncate" style="color:#f8fafc; font-weight:600;">\${b.name} <span style="font-size:10px; color:#64748b; font-weight:400;">(\${bowlTeam})</span></div></td>`
);

// 4. Update renderInnings call for innings1 - pass bowlTeam
content = content.replace(
  'html += renderInnings(m.innings1, "Innings 1", m.innings === 1);',
  'html += renderInnings(m.innings1, "Innings 1", m.innings === 1, m.innings2 ? m.innings2.batTeam : (m.bowlTeam || ""));'
);

// 5. Update renderInnings call for innings2 - pass bowlTeam
content = content.replace(
  'html += renderInnings(m.innings2, "Innings 2", m.innings === 2);',
  'html += renderInnings(m.innings2, "Innings 2", m.innings === 2, m.innings1 ? m.innings1.batTeam : (m.batTeam || ""));'
);

// 6. Fix the live scorecard fallback renderInnings call
content = content.replace(
  `html = renderInnings({
          batTeam: m.batTeam,`,
  `html = renderInnings({
          batTeam: m.batTeam,`
);

fs.writeFileSync('index.html', content);
console.log('Scorecard team tags added!');
