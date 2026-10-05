const VideoService = require('../services/videoProcessing/videoService');
const { apiResponse } = require('../utils/helpers');

/**
 * Controller for Live Recording and Video Endpoints
 */
class VideoController {
  /**
   * POST /api/video/process
   * Save and process a recorded live morph video
   */
  static async process(req, res, next) {
    try {
      let videoBuffer = null;
      let originalName = 'camera_morph.webm';

      if (req.file) {
        videoBuffer = req.file.buffer;
        originalName = req.file.originalname || originalName;
      } else if (req.body.video && typeof req.body.video === 'string') {
        const matches = req.body.video.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          videoBuffer = Buffer.from(matches[2], 'base64');
        }
      }

      if (!videoBuffer) {
        return res.status(400).json(apiResponse(false, null, 'No video file or recording data provided.'));
      }

      const result = await VideoService.processRecording(videoBuffer, originalName, req.body);
      res.status(200).json(apiResponse(true, result, 'Video recording saved successfully.'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = VideoController;
