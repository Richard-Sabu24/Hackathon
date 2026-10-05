/**
 * MaskLab CV-Service: Face Detection & Quality Analysis
 * Inspects source/target portrait photos or video frames for facial presence,
 * bounding geometry, resolution, sharpness, and alignment suitability.
 */

class FaceDetector {
  /**
   * Evaluates portrait quality and suitability for face swapping
   * @param {Object} params
   * @param {number} params.width Image width in pixels
   * @param {number} params.height Image height in pixels
   * @param {Object} params.landmarks Detected landmarks (if available)
   * @param {Object} params.bbox Bounding box {x, y, width, height}
   * @returns {Object} Quality assessment report
   */
  static assessQuality({ width, height, landmarks, bbox }) {
    const issues = [];
    let score = 100;

    // 1. Resolution Check
    if (width < 200 || height < 200) {
      score -= 40;
      issues.push('Low image resolution (minimum 200x200 recommended)');
    }

    // 2. Face Scale in Image
    if (bbox) {
      const faceArea = bbox.width * bbox.height;
      const totalArea = width * height;
      const coverage = faceArea / Math.max(1, totalArea);

      if (coverage < 0.04) {
        score -= 25;
        issues.push('Face is too small in the frame (occupies less than 4% of image)');
      }
      if (bbox.width < 80 || bbox.height < 80) {
        score -= 30;
        issues.push('Face pixel dimensions too low for high-fidelity identity transfer');
      }
    }

    // 3. Frontal Alignment & Eye Distance Check
    if (landmarks) {
      const eyeL = landmarks[33] || landmarks.leftEye;
      const eyeR = landmarks[263] || landmarks.rightEye;
      const nose = landmarks[1] || landmarks.nose;

      if (eyeL && eyeR) {
        const eyeDist = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
        if (eyeDist < 25) {
          score -= 25;
          issues.push('Interpupillary distance too narrow (face may be occluded or distant)');
        }

        // Head roll check
        const rollRad = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
        const rollDeg = Math.abs(rollRad * (180 / Math.PI));
        if (rollDeg > 35) {
          score -= 15;
          issues.push('Extreme head tilt detected; frontal portraits yield best identity match');
        }

        // Yaw asymmetry check
        if (nose) {
          const distL = Math.hypot(nose.x - eyeL.x, nose.y - eyeL.y);
          const distR = Math.hypot(eyeR.x - nose.x, eyeR.y - nose.y);
          const yawRatio = Math.max(distL, distR) / Math.max(0.001, Math.min(distL, distR));
          if (yawRatio > 2.5) {
            score -= 20;
            issues.push('Extreme head profile/yaw; front-facing portrait strongly recommended');
          }
        }
      }
    }

    const isGood = score >= 65 && issues.length === 0;
    return {
      score: Math.max(10, Math.min(100, score)),
      isGood: isGood,
      statusText: isGood ? 'TARGET QUALITY: GOOD ✓' : `TARGET QUALITY: LOW — ${issues[0] || 'PLEASE UPLOAD A CLEARER PORTRAIT'}`,
      issues: issues
    };
  }
}

module.exports = FaceDetector;
