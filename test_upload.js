const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');

(async () => {
  const samplePath = path.join(__dirname, 'sample-test.jpg');
  const buffer = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#808080' } }).jpeg().toBuffer();
  fs.writeFileSync(samplePath, buffer);

  const form = new FormData();
  form.append('image', fs.createReadStream(samplePath));

  const response = await axios.post('http://localhost:3000/upload', form, { headers: form.getHeaders() });
  console.log('Upload response:', response.status, response.data);
})();
