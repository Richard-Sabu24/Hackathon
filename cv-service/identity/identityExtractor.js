/**
 * MaskLab CV-Service: Identity Extractor
 * Creates a normalized canonical facial representation from the user's uploaded target photo.
 * Extracts the single unified face entity, isolates it from background,
 * and records biometric reference parameters.
 */

class IdentityExtractor {
  /**
   * Generates a normalized canonical facial identity descriptor
   * @param {Object} params
   * @param {string} params.name Target persona or file name
   * @param {Object} params.landmarks Normalized or pixel landmarks of target
   * @param {number} params.width Source image width
   * @param {number} params.height Source image height
   * @returns {Object} Canonical identity structure
   */
  static extractCanonicalIdentity({ name, landmarks, width = 800, height = 1000 }) {
    const eyeL = landmarks[33] || { x: width * 0.35, y: height * 0.40 };
    const eyeR = landmarks[263] || { x: width * 0.65, y: height * 0.40 };
    const nose = landmarks[1] || { x: width * 0.50, y: height * 0.53 };
    const chin = landmarks[152] || { x: width * 0.50, y: height * 0.84 };
    const forehead = landmarks[10] || { x: width * 0.50, y: height * 0.18 };

    const eyeCenter = {
      x: (eyeL.x + eyeR.x) * 0.5,
      y: (eyeL.y + eyeR.y) * 0.5
    };
    const eyeDist = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y) || 1;
    const roll = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);

    // Anatomical face boundaries
    const minX = Math.max(0, eyeCenter.x - eyeDist * 1.3);
    const maxX = Math.min(width, eyeCenter.x + eyeDist * 1.3);
    const minY = Math.max(0, forehead.y - eyeDist * 0.4);
    const maxY = Math.min(height, chin.y + eyeDist * 0.35);

    return {
      name: name,
      canonicalWidth: 512,
      canonicalHeight: 512,
      eyeCenter: eyeCenter,
      eyeDist: eyeDist,
      roll: roll,
      faceBounds: {
        x: minX,
        y: minY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
      },
      keyAnchors: {
        eyeLeft: eyeL,
        eyeRight: eyeR,
        eyeCenter: eyeCenter,
        nose: nose,
        chin: chin,
        forehead: forehead
      }
    };
  }
}

module.exports = IdentityExtractor;
