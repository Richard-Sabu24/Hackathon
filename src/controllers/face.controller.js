const fs = require('fs');
const path = require('path');
const FaceDetector = require('../services/faceMorph/faceDetector');
const MorphPipeline = require('../services/faceMorph/morphPipeline');
const { apiResponse } = require('../utils/helpers');

/**
 * Controller for Face Detection & Morphing Endpoints
 */
class FaceController {
  /**
   * POST /api/face/detect
   * Detect and validate face in uploaded image
   */
  static async detect(req, res, next) {
    try {
      let buffer = null;

      if (req.file) {
        buffer = req.file.buffer;
      } else if (req.body.image && typeof req.body.image === 'string') {
        // Base64 data URL support
        const matches = req.body.image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          buffer = Buffer.from(matches[2], 'base64');
        }
      }

      if (!buffer) {
        return res.status(400).json(apiResponse(false, null, 'No image file or image data provided.'));
      }

      const detection = await FaceDetector.detect(buffer);

      if (!detection.detected) {
        return res.status(422).json(apiResponse(false, detection, detection.reason));
      }

      res.status(200).json(apiResponse(true, detection, 'Face detected and biometric landmarks mapped successfully.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/face/morph
   * Morph Source Face towards Target Face
   */
  static async morph(req, res, next) {
    try {
      let sourceBuffer = null;
      let targetBuffer = null;

      // Extract source buffer
      if (req.files && req.files['source'] && req.files['source'][0]) {
        sourceBuffer = req.files['source'][0].buffer;
      } else if (req.body.sourceImage) {
        const matches = req.body.sourceImage.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          sourceBuffer = Buffer.from(matches[2], 'base64');
        }
      }

      // Extract target buffer
      if (req.files && req.files['target'] && req.files['target'][0]) {
        targetBuffer = req.files['target'][0].buffer;
      } else if (req.body.targetPersonaPath) {
        // Preset persona path on server (e.g. /images/personas/male_marcus.jpg)
        const localPersonaPath = path.join(__dirname, '../../public', req.body.targetPersonaPath.replace(/^\//, ''));
        if (fs.existsSync(localPersonaPath)) {
          targetBuffer = await fs.promises.readFile(localPersonaPath);
        }
      } else if (req.body.targetImage) {
        const matches = req.body.targetImage.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          targetBuffer = Buffer.from(matches[2], 'base64');
        }
      }

      // Validation
      if (!sourceBuffer) {
        return res.status(400).json(apiResponse(false, null, 'Source person image is required (INPUT A).'));
      }

      if (!targetBuffer) {
        return res.status(400).json(apiResponse(false, null, 'Target face image is required (INPUT B).'));
      }

      // Consent check
      const consent = req.body.consent === 'true' || req.body.consent === true || req.body.consent === '1';
      if (!consent) {
        return res.status(403).json(apiResponse(false, null, 'Responsible AI confirmation required: You must confirm you have permission to use this person\'s image.'));
      }

      const morphRatio = parseFloat(req.body.morphRatio) || 0.65;
      const skinHarmonize = parseFloat(req.body.skinHarmonize) || 0.85;

      const result = await MorphPipeline.process(sourceBuffer, targetBuffer, {
        morphRatio,
        skinHarmonize
      });

      if (!result.success) {
        return res.status(422).json(apiResponse(false, { stages: result.stages }, result.error));
      }

      res.status(200).json(apiResponse(true, result, 'Face transformation completed successfully.'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FaceController;
