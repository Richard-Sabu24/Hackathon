const VoiceService = require('../services/voiceTransform/voiceService');
const { apiResponse } = require('../utils/helpers');

/**
 * Controller for Voice Studio Endpoints
 */
class VoiceController {
  /**
   * POST /api/voice/transform
   * Transform uploaded voice audio
   */
  static async transform(req, res, next) {
    try {
      let audioBuffer = null;
      let originalName = 'recording.wav';

      if (req.file) {
        audioBuffer = req.file.buffer;
        originalName = req.file.originalname || originalName;
      } else if (req.body.audio && typeof req.body.audio === 'string') {
        const matches = req.body.audio.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          audioBuffer = Buffer.from(matches[2], 'base64');
        }
      }

      if (!audioBuffer) {
        return res.status(400).json(apiResponse(false, null, 'No audio file or audio data provided.'));
      }

      const style = req.body.style || 'female';
      const result = await VoiceService.transform(audioBuffer, originalName, style, req.body);

      res.status(200).json(apiResponse(true, result, `Voice transformed to ${result.style.name}.`));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/voice/styles
   * Return list of 9 available voice styles
   */
  static getStyles(req, res) {
    const styles = VoiceService.getStyles();
    res.status(200).json(apiResponse(true, styles));
  }
}

module.exports = VoiceController;
