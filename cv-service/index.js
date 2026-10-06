/**
 * MaskLab Computer Vision Service Entry Point
 * High-performance Face Identity-Transfer, Alignment, Pose Estimation,
 * Segmentation, and Color Harmonization Architecture.
 */

const FaceDetector = require('./detection/faceDetector');
const PoseEstimator = require('./alignment/poseEstimator');
const IdentityExtractor = require('./identity/identityExtractor');
const FaceSwapEngine = require('./swap/faceSwapEngine');
const FaceRestorer = require('./restoration/faceRestorer');
const { MaskGenerator, FACE_CONTOUR_INDICES } = require('./segmentation/maskGenerator');
const FaceMorphEngine = require('../public/js/faceMorphEngine');

module.exports = {
  FaceDetector,
  PoseEstimator,
  IdentityExtractor,
  FaceSwapEngine,
  FaceRestorer,
  MaskGenerator,
  FACE_CONTOUR_INDICES,
  FaceMorphEngine
};
