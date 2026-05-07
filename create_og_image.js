const sharp = require('sharp');

sharp('founder.png')
  .flatten({ background: '#ffffff' }) // Remove transparency, make it white
  .jpeg({ quality: 90 })
  .toFile('founder_og.jpg')
  .then(() => {
    console.log("Successfully created founder_og.jpg");
  })
  .catch(err => {
    console.error(err);
  });
