const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const THUMBNAILS_DIR = path.join(__dirname, '../../thumbnails');

if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

/**
 * @param {Buffer} imageBuffer 
 * @param {string} filename 
 * @returns {Promise<string>} 
 */
async function generateThumbnail(imageBuffer, filename) {
  try {
    const thumbnailPath = path.join(THUMBNAILS_DIR, `thumb_${filename}`);
    
    await sharp(imageBuffer)
      .resize(200, null, { fit: 'inside' })
      .toFile(thumbnailPath);
    
    return thumbnailPath;
  } catch (error) {
    console.error('Error al generar miniatura:', error);
    throw error;
  }
}

/**
 * @param {string} filename 
 * @returns {Promise<void>}
 */
async function deleteThumbnail(filename) {
  try {
    const thumbnailPath = path.join(THUMBNAILS_DIR, `thumb_${filename}`);
    
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }
  } catch (error) {
    console.error('Error al eliminar miniatura:', error);
  }
}

module.exports = {
  generateThumbnail,
  deleteThumbnail
};