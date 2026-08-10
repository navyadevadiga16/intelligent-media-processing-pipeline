const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDb, insertImage, getImageById, updateImageStatus, saveAnalysis, listAllImages } = require('./src/db');
const { startQueue, enqueueImage } = require('./src/queue');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
app.use(express.json());

// Serve uploaded images as static files
app.use('/uploads', express.static(uploadsDir));

// Serve a small static frontend for browsing images
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root to the upload page
app.get('/', (req, res) => {
  res.redirect('/upload.html');
});

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename(req, file, cb) {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 12 * 1024 * 1024 }
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required under field `image`' });
    }

    const image = await insertImage({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: req.file.path,
      status: 'pending'
    });

    enqueueImage(image.id);
    console.log(`Upload accepted: id=${image.id}, file=${image.filename}`);

    res.status(202).json({ id: image.id, status: image.status });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Unable to accept upload' });
  }
});

app.post('/upload-base64', async (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Base64 image data is required in `data`' });
    }

    const matches = data.match(/^data:(image\/[^;]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64 = data;
    if (matches) {
      mimeType = matches[1];
      base64 = matches[2];
    }

    const ext = path.extname(filename || '') || `.${mimeType.split('/')[1] || 'jpg'}`;
    const safeName = filename ? path.basename(filename, ext) : `upload-${Date.now()}`;
    const uniqueName = `${safeName}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const storagePath = path.join(uploadsDir, uniqueName);

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }

    fs.writeFileSync(storagePath, buffer);

    const image = await insertImage({
      filename: uniqueName,
      originalName: filename || uniqueName,
      mimeType,
      size: buffer.length,
      storagePath,
      status: 'pending'
    });

    enqueueImage(image.id);
    console.log(`Base64 upload accepted: id=${image.id}, file=${image.filename}`);

    res.status(202).json({ id: image.id, status: image.status });
  } catch (error) {
    console.error('Base64 upload error:', error);
    res.status(500).json({ error: 'Unable to accept base64 upload' });
  }
});

app.get('/status/:id', async (req, res) => {
  const image = await getImageById(req.params.id);
  if (!image) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  res.json({ id: image.id, status: image.status, failureReason: image.failureReason || null });
});

app.get('/results/:id', async (req, res) => {
  const image = await getImageById(req.params.id);
  if (!image) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  if (image.status !== 'completed' && image.status !== 'failed') {
    return res.status(409).json({ error: 'Results are not ready yet' });
  }
  const analysis = image.analysis ? JSON.parse(image.analysis) : null;
  res.json({ id: image.id, status: image.status, analysis, failureReason: image.failureReason || null });
});

// API: list uploaded images with metadata and analysis status
app.get('/api/images', async (req, res) => {
  try {
    const images = await listAllImages();
    const payload = images.map((image) => {
      const analysis = image.analysis ? JSON.parse(image.analysis) : null;
      const blurry = analysis ? analysis.issues?.includes('blurry image') : false;
      const statusText = analysis
        ? blurry ? 'Blurry' : 'Normal'
        : image.status === 'pending' ? 'Pending' : 'Processing';

      return {
        id: image.id,
        filename: image.filename,
        url: `/uploads/${encodeURIComponent(image.filename)}`,
        size: image.size,
        status: image.status,
        analysis,
        blurry,
        statusText
      };
    });
    res.json(payload);
  } catch (err) {
    console.error('Unable to load image list:', err);
    res.status(500).json({ error: 'Unable to read uploads' });
  }
});

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Vehicle image analyzer listening on http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
      if (port === DEFAULT_PORT) {
        const nextPort = port + 1;
        console.warn(`Trying to start on port ${nextPort} instead...`);
        setTimeout(() => startServer(nextPort), 100);
      } else {
        console.error(`Failed to bind to port ${port}.`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
}

(async () => {
  await initDb();
  startQueue();
  startServer(DEFAULT_PORT);
})();
