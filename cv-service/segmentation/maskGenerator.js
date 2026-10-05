/**
 * MaskLab CV-Service: Biological Face Segmentation Mask Generator
 * Generates an anatomical facial boundary following actual facial geometry:
 * - Traces lower jawline & chin (feathering into source neck)
 * - Traces side cheek/temple contours (strictly inside ears & sideburns)
 * - Traces upper forehead margin (strictly below hairline/bangs)
 * Never produces a rectangle, triangle mesh, or arbitrary bounding box.
 */

// Key facial contour indices (ordered perimeter from left temple down jawline to right temple)
const FACE_CONTOUR_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

class MaskGenerator {
  /**
   * Generates SVG path data for the anatomical face contour
   * @param {Object} points Keypoints dictionary
   * @returns {string} SVG Path definition string
   */
  static getSvgContourPath(points) {
    let d = '';
    for (let i = 0; i < FACE_CONTOUR_INDICES.length; i++) {
      const idx = FACE_CONTOUR_INDICES[i];
      const pt = points[idx];
      if (!pt) continue;
      if (d === '') {
        d += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      } else {
        d += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      }
    }
    if (d !== '') d += ' Z';
    return d;
  }

  /**
   * Draws feathered anatomical biological mask onto a canvas 2D context
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} points Aligned face contour points
   * @param {number} featherRadius Blur feather radius in pixels
   */
  static renderAnatomicalMask(ctx, points, featherRadius = 20) {
    ctx.save();
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < FACE_CONTOUR_INDICES.length; i++) {
      const idx = FACE_CONTOUR_INDICES[i];
      const pt = points[idx];
      if (!pt) continue;

      if (!started) {
        ctx.moveTo(pt.x, pt.y);
        started = true;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }

    if (started) {
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = featherRadius;
      ctx.fill();
    }
    ctx.restore();
  }
}

module.exports = {
  MaskGenerator,
  FACE_CONTOUR_INDICES
};
