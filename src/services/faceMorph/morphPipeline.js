const path = require('path');
const fs = require('fs');
const FaceDetector = require('./faceDetector');
const FaceAligner = require('./faceAligner');
const FaceBlender = require('./faceBlender');

class MorphPipeline {
  /**
   * Run the end-to-end Face Morphing Pipeline
   * @param {Buffer} sourceBuffer 
   * @param {Buffer} targetBuffer 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  static async process(sourceBuffer, targetBuffer, options = {}) {
    const startTime = Date.now();
    const stages = [];

    // Stage 1: Face Detection & Validation
    stages.push({ stage: 'detection', name: 'Detecting face in Source and Target images...', timeMs: 0 });
    const [sourceDetection, targetDetection] = await Promise.all([
      FaceDetector.detect(sourceBuffer),
      FaceDetector.detect(targetBuffer)
    ]);

    if (!sourceDetection.detected) {
      return {
        success: false,
        error: `Source Image: ${sourceDetection.reason}`,
        stage: 'source_detection',
        stages
      };
    }

    if (!targetDetection.detected) {
      return {
        success: false,
        error: `Target Face Image: ${targetDetection.reason}`,
        stage: 'target_detection',
        stages
      };
    }

    stages.push({
      stage: 'landmarks',
      name: 'Mapping 468 biometric landmarks & facial contours...',
      timeMs: Date.now() - startTime,
      sourceConfidence: sourceDetection.confidence,
      targetConfidence: targetDetection.confidence
    });

    // Stage 2: Geometric Face Alignment
    stages.push({
      stage: 'alignment',
      name: 'Aligning target face rotation, scale and affine matrix...',
      timeMs: Date.now() - startTime
    });

    const alignment = FaceAligner.computeAlignment(
      sourceDetection.landmarks,
      targetDetection.landmarks,
      sourceDetection.resolution,
      targetDetection.resolution
    );
    alignment.targetBbox = targetDetection.bbox;
    alignment.sourceBbox = sourceDetection.bbox;

    // Stage 3: Transformation, Warping, Skin Harmonization & Blending
    stages.push({
      stage: 'transformation',
      name: 'Executing holistic facial identity projection & skin tone harmonization...',
      timeMs: Date.now() - startTime
    });

    stages.push({
      stage: 'blending',
      name: 'Applying feathered alpha mask and Poisson boundary blending...',
      timeMs: Date.now() - startTime
    });

    const blendedBuffer = await FaceBlender.blend(
      sourceBuffer,
      targetBuffer,
      alignment,
      options
    );

    // Stage 4: Finalizing & Storage
    stages.push({
      stage: 'finalizing',
      name: 'Finalizing high-resolution result and embedding AI disclosure...',
      timeMs: Date.now() - startTime
    });

    const filename = `morph_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const uploadsDir = path.join(__dirname, '../../../public/uploads/morphs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, blendedBuffer);

    const base64Data = `data:image/jpeg;base64,${blendedBuffer.toString('base64')}`;
    const totalDurationMs = Date.now() - startTime;

    return {
      success: true,
      resultUrl: `/uploads/morphs/${filename}`,
      dataUrl: base64Data,
      totalDurationMs,
      stages,
      metadata: {
        resolution: sourceDetection.resolution,
        morphRatio: options.morphRatio || 0.65,
        alignment: {
          scale: alignment.scale,
          rotationDeg: alignment.rotationDeg,
          translation: alignment.translation
        },
        sourceFace: {
          confidence: sourceDetection.confidence,
          bbox: sourceDetection.bbox
        },
        targetFace: {
          confidence: targetDetection.confidence,
          bbox: targetDetection.bbox
        }
      }
    };
  }
}

module.exports = MorphPipeline;
