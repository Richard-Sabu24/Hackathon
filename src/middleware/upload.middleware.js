const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadBase = path.join(__dirname, '../../public/uploads');
const dirs = ['faces', 'voices', 'videos', 'morphs'];
dirs.forEach((dir) => {
  const fullPath = path.join(uploadBase, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Memory storage for fast streaming and buffer processing
const storage = multer.memoryStorage();

// File filter for image formats
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image format: ${file.mimetype}. Allowed: JPG, PNG, WEBP.`), false);
  }
};

// File filter for audio formats
const audioFilter = (req, file, cb) => {
  const allowedTypes = [
    'audio/wav', 'audio/x-wav', 'audio/wave',
    'audio/mpeg', 'audio/mp3',
    'audio/ogg', 'audio/vorbis',
    'audio/webm', 'audio/x-m4a', 'audio/mp4', 'audio/aac'
  ];
  if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid audio format: ${file.mimetype}. Allowed: WAV, MP3, OGG, M4A, WEBM.`), false);
  }
};

// File filter for video formats
const videoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid video format: ${file.mimetype}. Allowed: WEBM, MP4.`), false);
  }
};

const uploadImages = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: imageFilter
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: audioFilter
});

const uploadVideo = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: videoFilter
});

module.exports = {
  uploadImages,
  uploadAudio,
  uploadVideo
};
