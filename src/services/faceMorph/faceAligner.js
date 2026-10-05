/**
 * Face Geometry Aligner & Landmark Triangulation
 * Calculates similarity transform (scale, rotation, translation) and
 * Delaunay facial mesh triangles between Source and Target faces.
 */
class FaceAligner {
  /**
   * Compute alignment parameters from Source and Target landmarks
   * @param {Object} sourceLandmarks 
   * @param {Object} targetLandmarks 
   * @param {Object} sourceRes 
   * @param {Object} targetRes 
   * @returns {Object}
   */
  static computeAlignment(sourceLandmarks, targetLandmarks, sourceRes, targetRes) {
    const sEyes = {
      lx: sourceLandmarks.leftEye.x,
      ly: sourceLandmarks.leftEye.y,
      rx: sourceLandmarks.rightEye.x,
      ry: sourceLandmarks.rightEye.y,
      cx: (sourceLandmarks.leftEye.x + sourceLandmarks.rightEye.x) * 0.5,
      cy: (sourceLandmarks.leftEye.y + sourceLandmarks.rightEye.y) * 0.5
    };

    const tEyes = {
      lx: targetLandmarks.leftEye.x,
      ly: targetLandmarks.leftEye.y,
      rx: targetLandmarks.rightEye.x,
      ry: targetLandmarks.rightEye.y,
      cx: (targetLandmarks.leftEye.x + targetLandmarks.rightEye.x) * 0.5,
      cy: (targetLandmarks.leftEye.y + targetLandmarks.rightEye.y) * 0.5
    };

    // Calculate eye distance
    const sDist = Math.hypot(sEyes.rx - sEyes.lx, sEyes.ry - sEyes.ly) || 50;
    const tDist = Math.hypot(tEyes.rx - tEyes.lx, tEyes.ry - tEyes.ly) || 50;

    // Scale ratio to match eye distances
    const scale = sDist / tDist;

    // Roll angle (in radians and degrees)
    const sAngle = Math.atan2(sEyes.ry - sEyes.ly, sEyes.rx - sEyes.lx);
    const tAngle = Math.atan2(tEyes.ry - tEyes.ly, tEyes.rx - tEyes.lx);
    const deltaAngleRad = sAngle - tAngle;
    const deltaAngleDeg = (deltaAngleRad * 180) / Math.PI;

    // Transformed dimensions of target image
    const transformedW = Math.round(targetRes.width * scale);
    const transformedH = Math.round(targetRes.height * scale);

    // Target eye center scaled
    const tCenterScaledX = tEyes.cx * scale;
    const tCenterScaledY = tEyes.cy * scale;

    // Translation to position target eye center exactly on source eye center
    const tx = Math.round(sEyes.cx - tCenterScaledX);
    const ty = Math.round(sEyes.cy - tCenterScaledY);

    // Bounding region on source image for facial blending
    const sChin = sourceLandmarks.chin || { x: sEyes.cx, y: sEyes.cy + sDist * 1.6 };
    const sNose = sourceLandmarks.nose || { x: sEyes.cx, y: sEyes.cy + sDist * 0.6 };
    const sForehead = sourceLandmarks.forehead || { x: sEyes.cx, y: sEyes.cy - sDist * 0.8 };

    const faceRadiusX = Math.round(sDist * 1.15);
    const faceRadiusY = Math.round((sChin.y - sForehead.y) * 0.55);
    const faceCenter = {
      x: Math.round(sNose.x),
      y: Math.round((sForehead.y + sChin.y) * 0.5)
    };

    // Delaunay landmark keypoint correspondences for morphing
    const meshTriangles = [
      // Forehead & Eyes
      ['forehead', 'leftEye', 'nose'],
      ['forehead', 'rightEye', 'nose'],
      ['leftEye', 'rightEye', 'nose'],
      // Cheeks & Nose
      ['leftEye', 'leftCheek', 'nose'],
      ['rightEye', 'rightCheek', 'nose'],
      ['leftCheek', 'mouth', 'nose'],
      ['rightCheek', 'mouth', 'nose'],
      // Mouth & Chin
      ['leftCheek', 'mouth', 'chin'],
      ['rightCheek', 'mouth', 'chin']
    ];

    return {
      scale: Number(scale.toFixed(4)),
      rotationDeg: Number(deltaAngleDeg.toFixed(2)),
      rotationRad: Number(deltaAngleRad.toFixed(4)),
      translation: { x: tx, y: ty },
      targetDimensions: { width: transformedW, height: transformedH },
      faceCenter,
      faceRadius: { x: faceRadiusX, y: faceRadiusY },
      meshTriangles
    };
  }
}

module.exports = FaceAligner;
