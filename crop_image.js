const sharp = require('sharp');

sharp('founder.png')
  .extract({ left: 0, top: 0, width: 795, height: 900 })
  .toFile('founder_cropped.png')
  .then(() => {
    const fs = require('fs');
    fs.renameSync('founder_cropped.png', 'founder.png');
    console.log("Successfully cropped K C P from the bottom!");
  })
  .catch(err => {
    console.error(err);
  });
