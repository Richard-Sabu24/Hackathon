const express = require('express');
const router = express.Router();
const FaceController = require('../controllers/face.controller');
const VoiceController = require('../controllers/voice.controller');
const VideoController = require('../controllers/video.controller');
const indexController = require('../controllers/index.controller');
const { uploadImages, uploadAudio, uploadVideo } = require('../middleware/upload.middleware');

// Health Check
router.get('/health', indexController.getHealth);

// Face Morphing Endpoints
router.post('/face/detect', uploadImages.single('image'), FaceController.detect);
router.post(
  '/face/morph',
  uploadImages.fields([
    { name: 'source', maxCount: 1 },
    { name: 'target', maxCount: 1 }
  ]),
  FaceController.morph
);

// Voice Studio Endpoints
router.get('/voice/styles', VoiceController.getStyles);
router.post('/voice/transform', uploadAudio.single('audio'), VoiceController.transform);

// Video Recording & Processing Endpoints
router.post('/video/process', uploadVideo.single('video'), VideoController.process);

// Projects Management
router.get('/projects', indexController.getProjects);
router.post('/projects', indexController.createProject);

// Session & Auth
router.post('/auth/login', indexController.handleLogin);

module.exports = router;
