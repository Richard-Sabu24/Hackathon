/**
 * MaskLab CV-Service: Head Pose Estimator & Temporal Stabilizer
 * Computes 6-Degrees-of-Freedom (6-DoF) Head Pose:
 * - Yaw (Head turning Left/Right)
 * - Pitch (Head looking Up/Down)
 * - Roll (Head tilting Left/Right)
 * - Center (X, Y in canvas coordinates)
 * - Scale (Inter-pupillary distance relative to canonical portrait)
 * Includes Exponential Moving Average (EMA) Temporal Smoothing to eliminate jitter & drifting.
 */

class PoseEstimator {
  /**
   * Estimates 3D head pose from facial keypoints
   * @param {Object} points Map or array of facial landmarks with {x, y, z}
   * @param {number} cw Canvas/image width
   * @param {number} ch Canvas/image height
   * @returns {Object} Pose parameters {yaw, pitch, roll, center, scale, mouthOpen, eyeApertureL, eyeApertureR}
   */
  static estimatePose(points, cw = 1280, ch = 720) {
    const eyeL = points[33] || points[133] || { x: cw * 0.35, y: ch * 0.4 };
    const eyeR = points[263] || points[362] || { x: cw * 0.65, y: ch * 0.4 };
    const nose = points[1] || points[168] || { x: cw * 0.5, y: ch * 0.52 };
    const chin = points[152] || { x: cw * 0.5, y: ch * 0.82 };
    const forehead = points[10] || { x: cw * 0.5, y: ch * 0.20 };
    const lipTop = points[13] || { x: cw * 0.5, y: ch * 0.66 };
    const lipBottom = points[14] || { x: cw * 0.5, y: ch * 0.70 };

    // Eye midpoint (Center of eye axis)
    const eyeCenterX = (eyeL.x + eyeR.x) * 0.5;
    const eyeCenterY = (eyeL.y + eyeR.y) * 0.5;

    // Face Center: slightly below eye center along nasal axis
    const centerX = eyeCenterX * 0.6 + nose.x * 0.4;
    const centerY = eyeCenterY * 0.6 + nose.y * 0.4;

    // Inter-pupillary distance & Roll
    const dx = eyeR.x - eyeL.x;
    const dy = eyeR.y - eyeL.y;
    const eyeDist = Math.hypot(dx, dy) || 1;
    const rollRad = Math.atan2(dy, dx);
    const rollDeg = rollRad * (180 / Math.PI);

    // Yaw estimation: differential ratio of nose to eyes
    const distToLeftEye = Math.hypot(nose.x - eyeL.x, nose.y - eyeL.y);
    const distToRightEye = Math.hypot(eyeR.x - nose.x, eyeR.y - nose.y);
    const totalEyeSpan = distToLeftEye + distToRightEye;
    const yawNormalized = (distToRightEye - distToLeftEye) / Math.max(1, totalEyeSpan);
    const yawDeg = yawNormalized * 55.0; // Scaled to degree approximation

    // Pitch estimation: ratio of eye-to-nose vs nose-to-chin
    const eyeToNose = Math.max(1, nose.y - eyeCenterY);
    const noseToChin = Math.max(1, chin.y - nose.y);
    const pitchRatio = eyeToNose / (eyeToNose + noseToChin);
    const pitchDeg = (pitchRatio - 0.44) * 80.0;

    // Dynamic expressions
    const mouthOpen = Math.max(0, lipBottom.y - lipTop.y);

    // Eye apertures for blink detection
    const eyeLTop = points[159] || eyeL;
    const eyeLBottom = points[145] || eyeL;
    const eyeRTop = points[386] || eyeR;
    const eyeRBottom = points[374] || eyeR;
    const eyeApertureL = Math.max(0, eyeLBottom.y - eyeLTop.y) / (eyeDist * 0.25 || 1);
    const eyeApertureR = Math.max(0, eyeRBottom.y - eyeRTop.y) / (eyeDist * 0.25 || 1);

    return {
      center: { x: centerX, y: centerY },
      eyeCenter: { x: eyeCenterX, y: eyeCenterY },
      eyeDist: eyeDist,
      roll: rollRad,
      rollDeg: rollDeg,
      yaw: yawNormalized,
      yawDeg: yawDeg,
      pitch: pitchRatio - 0.44,
      pitchDeg: pitchDeg,
      mouthOpen: mouthOpen,
      isBlinking: eyeApertureL < 0.25 && eyeApertureR < 0.25,
      eyeApertureL: eyeApertureL,
      eyeApertureR: eyeApertureR
    };
  }

  /**
   * Applies Exponential Moving Average (EMA) to smooth pose transitions
   * @param {Object} current Current raw pose
   * @param {Object|null} previous Previous smoothed pose
   * @param {number} baseAlpha Base smoothing factor (0.0 to 1.0)
   * @returns {Object} Smoothed pose
   */
  static smoothPose(current, previous, baseAlpha = 0.40) {
    if (!previous) return { ...current };

    // Velocity-aware dynamic alpha: if head is moving fast, increase responsiveness
    const deltaX = Math.abs(current.center.x - previous.center.x);
    const deltaY = Math.abs(current.center.y - previous.center.y);
    const moveDist = Math.hypot(deltaX, deltaY);
    const adaptiveAlpha = Math.min(0.85, Math.max(baseAlpha, moveDist / 40));

    return {
      center: {
        x: previous.center.x + adaptiveAlpha * (current.center.x - previous.center.x),
        y: previous.center.y + adaptiveAlpha * (current.center.y - previous.center.y)
      },
      eyeCenter: {
        x: previous.eyeCenter.x + adaptiveAlpha * (current.eyeCenter.x - previous.eyeCenter.x),
        y: previous.eyeCenter.y + adaptiveAlpha * (current.eyeCenter.y - previous.eyeCenter.y)
      },
      eyeDist: previous.eyeDist + adaptiveAlpha * (current.eyeDist - previous.eyeDist),
      roll: previous.roll + adaptiveAlpha * (current.roll - previous.roll),
      rollDeg: previous.rollDeg + adaptiveAlpha * (current.rollDeg - previous.rollDeg),
      yaw: previous.yaw + adaptiveAlpha * (current.yaw - previous.yaw),
      yawDeg: previous.yawDeg + adaptiveAlpha * (current.yawDeg - previous.yawDeg),
      pitch: previous.pitch + adaptiveAlpha * (current.pitch - previous.pitch),
      pitchDeg: previous.pitchDeg + adaptiveAlpha * (current.pitchDeg - previous.pitchDeg),
      mouthOpen: previous.mouthOpen + 0.65 * (current.mouthOpen - previous.mouthOpen),
      isBlinking: current.isBlinking,
      eyeApertureL: previous.eyeApertureL + 0.5 * (current.eyeApertureL - previous.eyeApertureL),
      eyeApertureR: previous.eyeApertureR + 0.5 * (current.eyeApertureR - previous.eyeApertureR)
    };
  }
}

module.exports = PoseEstimator;
