const sharp = require('sharp');

/**
 * Face Blender Service
 * Harmonizes skin tone, generates feathered facial alpha boundaries,
 * and seamlessly blends transformed target face into source composition.
 */
class FaceBlender {
  /**
   * Harmonize and blend target face into source image
   * @param {Buffer} sourceBuffer 
   * @param {Buffer} targetBuffer 
   * @param {Object} alignment 
   * @param {Object} options 
   * @returns {Promise<Buffer>}
   */
  static async blend(sourceBuffer, targetBuffer, alignment, options = {}) {
    const morphRatio = typeof options.morphRatio === 'number' ? options.morphRatio : 0.65;
    const skinHarmonize = typeof options.skinHarmonize === 'number' ? options.skinHarmonize : 0.85;

    const sourceMeta = await sharp(sourceBuffer).metadata();
    const sW = sourceMeta.width;
    const sH = sourceMeta.height;

    const {
      scale,
      rotationDeg,
      faceCenter,
      faceRadius
    } = alignment;

    // Radius clamping
    const rx = Math.max(30, Math.min(Math.round(faceRadius.x * 1.1), Math.round(sW * 0.45)));
    const ry = Math.max(40, Math.min(Math.round(faceRadius.y * 1.15), Math.round(sH * 0.45)));
    const cx = Math.max(rx, Math.min(faceCenter.x, sW - rx));
    const cy = Math.max(ry, Math.min(faceCenter.y, sH - ry));

    const cropW = rx * 2;
    const cropH = ry * 2;
    const cropLeft = Math.max(0, cx - rx);
    const cropTop = Math.max(0, cy - ry);

    // Step 1: Extract target face strictly from facial bounding box (eliminating photo background)
    let transformedTarget = sharp(targetBuffer);
    if (alignment.targetBbox && alignment.targetBbox.width > 20 && alignment.targetBbox.height > 20) {
      try {
        const tMeta = await sharp(targetBuffer).metadata();
        const marginX = Math.round(alignment.targetBbox.width * 0.12);
        const marginY = Math.round(alignment.targetBbox.height * 0.12);
        const left = Math.max(0, alignment.targetBbox.x - marginX);
        const top = Math.max(0, alignment.targetBbox.y - marginY);
        const width = Math.min(tMeta.width - left, alignment.targetBbox.width + marginX * 2);
        const height = Math.min(tMeta.height - top, alignment.targetBbox.height + marginY * 2);
        if (width > 20 && height > 20) {
          transformedTarget = transformedTarget.extract({ left, top, width, height });
        }
      } catch (err) {
        console.warn('Target facial bbox extract warning, continuing with full image:', err.message);
      }
    }

    if (Math.abs(rotationDeg) > 0.5) {
      transformedTarget = transformedTarget.rotate(rotationDeg, {
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      });
    }

    // Resize target face to match eye-scale and facial bounds
    transformedTarget = transformedTarget.resize(cropW, cropH, {
      fit: 'cover',
      position: 'centre'
    });

    // Step 2: Skin Tone Harmonization
    // Sample source skin color in facial core
    let tintR = 230, tintG = 200, tintB = 180;
    try {
      const sampleArea = await sharp(sourceBuffer)
        .extract({
          left: Math.max(0, Math.round(cx - 10)),
          top: Math.max(0, Math.round(cy - 10)),
          width: 20,
          height: 20
        })
        .stats();

      if (sampleArea && sampleArea.channels && sampleArea.channels.length >= 3) {
        tintR = Math.round(sampleArea.channels[0].mean);
        tintG = Math.round(sampleArea.channels[1].mean);
        tintB = Math.round(sampleArea.channels[2].mean);
      }
    } catch (e) {
      // Fallback to warm natural tone
    }

    if (skinHarmonize > 0.1) {
      // Modulate target skin tone to match source lighting
      transformedTarget = transformedTarget.tint({
        r: Math.round(tintR * 0.9 + 25),
        g: Math.round(tintG * 0.9 + 20),
        b: Math.round(tintB * 0.9 + 15)
      });
    }

    const processedTargetBuffer = await transformedTarget.png().toBuffer();

    // Step 3: Generate smooth anatomical feathered alpha mask (SVG)
    // Inner 65% is solid, outer 35% feathers to 0 to keep hair, ears and neck intact
    const maxAlpha = Math.min(1.0, Math.max(0.1, morphRatio));
    const maskSvg = `
      <svg width="${cropW}" height="${cropH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="featherGrad" cx="50%" cy="48%" r="50%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="${maxAlpha}" />
            <stop offset="65%" stop-color="#ffffff" stop-opacity="${maxAlpha * 0.9}" />
            <stop offset="85%" stop-color="#ffffff" stop-opacity="${maxAlpha * 0.4}" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="${rx}" cy="${ry}" rx="${rx * 0.95}" ry="${ry * 0.95}" fill="url(#featherGrad)" />
      </svg>
    `;

    // Apply alpha mask to target face
    const maskedTargetBuffer = await sharp(processedTargetBuffer)
      .composite([{
        input: Buffer.from(maskSvg),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    // Step 4: Subtle "AI TRANSFORMED" Watermark (Responsible AI)
    const watermarkSvg = `
      <svg width="${sW}" height="${sH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${sW - 135}" y="${sH - 28}" width="125" height="20" rx="4" fill="rgba(10, 15, 26, 0.7)" />
        <text x="${sW - 130 + 62}" y="${sH - 14}" font-family="monospace, sans-serif" font-size="10" font-weight="bold" fill="#06b6d4" text-anchor="middle">AI TRANSFORMED</text>
      </svg>
    `;

    // Step 5: Final Composite over Source Image
    const finalResult = await sharp(sourceBuffer)
      .composite([
        {
          input: maskedTargetBuffer,
          top: cropTop,
          left: cropLeft,
          blend: 'over'
        },
        {
          input: Buffer.from(watermarkSvg),
          top: 0,
          left: 0,
          blend: 'over'
        }
      ])
      .jpeg({ quality: 94 })
      .toBuffer();

    return finalResult;
  }
}

module.exports = FaceBlender;
