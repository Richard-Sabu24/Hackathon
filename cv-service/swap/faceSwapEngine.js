/**
 * MaskLab CV-Service: Holistic Face Swap & Identity Transfer Engine
 * Transforms the entire target facial identity as ONE COMPLETE, COHERENT ENTITY.
 * - Zero Delaunay triangle slicing
 * - Zero polygonal seams or torn facial fragments
 * - Projects entire canonical face through global similarity & perspective alignment
 * - Retains source head pose (yaw, pitch, roll, center, scale)
 * - Harmonizes lighting and skin tone
 * - Blends seamlessly via biological contour mask
 */

const PoseEstimator = require('../alignment/poseEstimator');
const FaceRestorer = require('../restoration/faceRestorer');
const { MaskGenerator, FACE_CONTOUR_INDICES } = require('../segmentation/maskGenerator');

class FaceSwapEngine {
  /**
   * Calculates the global transformation matrix mapping canonical target face onto source head
   * @param {Object} sourcePose Source head pose {center, eyeCenter, eyeDist, roll, yaw, pitch}
   * @param {Object} targetCanonical Target canonical geometry {eyeCenter, eyeDist, roll}
   * @param {number} scaleMultiplier User scale factor (e.g. 1.0)
   * @returns {Object} Affine transform parameters {a, b, c, d, e, f, scaleX, scaleY}
   */
  static computeHolisticTransform(sourcePose, targetCanonical, scaleMultiplier = 1.0) {
    const sEyeDist = sourcePose.eyeDist || 1;
    const tEyeDist = targetCanonical.eyeDist || 160;

    // Base uniform scale from inter-pupillary distance
    const baseScale = (sEyeDist / tEyeDist) * scaleMultiplier;

    // 3D perspective foreshortening compensation:
    // Yaw compresses the horizontal scale slightly; Pitch compresses vertical scale
    const yawComp = Math.cos(Math.min(1.2, Math.abs(sourcePose.yaw || 0) * 0.8));
    const pitchComp = Math.cos(Math.min(1.2, Math.abs(sourcePose.pitch || 0) * 0.8));

    const scaleX = baseScale * yawComp;
    const scaleY = baseScale * pitchComp;

    // Rotation delta
    const sRoll = sourcePose.roll || 0;
    const tRoll = targetCanonical.roll || 0;
    const deltaAngle = sRoll - tRoll;

    const cosA = Math.cos(deltaAngle);
    const sinA = Math.sin(deltaAngle);

    // 2D Affine Matrix components
    const a = cosA * scaleX;
    const b = sinA * scaleX;
    const c = -sinA * scaleY;
    const d = cosA * scaleY;

    // Target eye center mapping to source eye center
    const tCenter = targetCanonical.eyeCenter || { x: 256, y: 200 };
    const sCenter = sourcePose.eyeCenter || sourcePose.center;

    // Translation e, f so that target eye center lands exactly on source eye center
    const e = sCenter.x - (a * tCenter.x + c * tCenter.y);
    const f = sCenter.y - (b * tCenter.x + d * tCenter.y);

    return { a, b, c, d, e, f, scaleX, scaleY, angle: deltaAngle };
  }

  /**
   * Applies the holistic transform to facial contour points for biological mask generation
   * @param {Array<Object>} targetContourPoints Normalized or canonical points of target contour
   * @param {Object} matrix Affine transform matrix {a, b, c, d, e, f}
   * @param {Object} sourcePose For dynamic expression (jaw/mouth speech tracking)
   * @returns {Object} Transformed points dictionary
   */
  static transformContourPoints(targetContourPoints, matrix, sourcePose) {
    const transformed = {};
    const { a, b, c, d, e, f } = matrix;
    const mouthOpen = sourcePose.mouthOpen || 0;

    // Lip & lower chin indices that respond dynamically to speech
    const speechDeformIndices = new Set([152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234]);

    for (let i = 0; i < FACE_CONTOUR_INDICES.length; i++) {
      const idx = FACE_CONTOUR_INDICES[i];
      const pt = targetContourPoints[idx] || { x: 256, y: 256 };

      let px = pt.x;
      let py = pt.y;

      // Dynamic mouth speech deformation without breaking mesh
      if (speechDeformIndices.has(idx) && mouthOpen > 2) {
        py += mouthOpen * 0.25;
      }

      transformed[idx] = {
        x: a * px + c * py + e,
        y: b * px + d * py + f
      };
    }

    return transformed;
  }
}

module.exports = FaceSwapEngine;
