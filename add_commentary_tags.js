const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Normal runs commentary: "${b} to ${s}, X runs"
content = content.replace(
  "text: `${b} to ${s}, ${r} run${r == 1 ? '' : 's'}${shotType ? ', ' + shotType : ''}`",
  "text: `${b} (${matchBowlTeam}) to ${s} (${matchBatTeam}), ${r} run${r == 1 ? '' : 's'}${shotType ? ', ' + shotType : ''}`"
);

// 2. Bye commentary: "${bowler.value} to ${strike.value}, Bye X runs"
content = content.replace(
  "text: `${bowler.value} to ${strike.value}, Bye ${runs} run${runs !== 1 ? 's' : ''}`",
  "text: `${bowler.value} (${matchBowlTeam}) to ${strike.value} (${matchBatTeam}), Bye ${runs} run${runs !== 1 ? 's' : ''}`"
);

// 3. Wicket commentary: "${bowler.value} to ${outPlayer}, OUT, ${outDesc}"
content = content.replace(
  "text: `${bowler.value} to ${outPlayer}, OUT, ${outDesc}`",
  "text: `${bowler.value} (${matchBowlTeam}) to ${outPlayer} (${matchBatTeam}), OUT, ${outDesc}`"
);

// 4. Wicket sub text: "${outPlayer} ${outDesc} b ${bowler.value}"
content = content.replace(
  "subText: `${outPlayer} ${outDesc} b ${bowler.value} (${batsmanStats[outPlayer].runs}r ${batsmanStats[outPlayer].balls}b)`",
  "subText: `${outPlayer} (${matchBatTeam}) ${outDesc} b ${bowler.value} (${matchBowlTeam}) (${batsmanStats[outPlayer].runs}r ${batsmanStats[outPlayer].balls}b)`"
);

// Check how many wide/noball commentary lines exist
let wideIdx = content.indexOf('to ${strike.value}, Wide');
let noballIdx = content.indexOf('to ${strike.value}, No Ball');
console.log('Wide found at char:', wideIdx);
console.log('NoBall found at char:', noballIdx);

// 5. Wide commentary
content = content.replace(
  /`\$\{bowler\.value\} to \$\{strike\.value\}, Wide/g,
  '`${bowler.value} (${matchBowlTeam}) to ${strike.value} (${matchBatTeam}), Wide'
);

// 6. No Ball commentary  
content = content.replace(
  /`\$\{bowler\.value\} to \$\{strike\.value\}, No Ball/g,
  '`${bowler.value} (${matchBowlTeam}) to ${strike.value} (${matchBatTeam}), No Ball'
);

fs.writeFileSync('index.html', content);
console.log('Commentary team tags added!');
