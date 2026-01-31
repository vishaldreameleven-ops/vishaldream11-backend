const cloudinary = require('../config/cloudinary');

class CloudinaryService {
  /**
   * Extract publicId from Cloudinary URL
   * Example: https://res.cloudinary.com/.../upload/v123/dream11tips/plans/abc.jpg
   * Returns: "dream11tips/plans/abc"
   */
  extractPublicIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      // Match pattern: /upload/v{digits}/{path}/{filename}
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (error) {
      console.error('Error extracting publicId from URL:', error);
    }

    return null;
  }

  /**
   * Delete single image from Cloudinary
   * Non-blocking, logs errors without throwing
   */
  async deleteImage(publicId, url = null) {
    try {
      // Extract if needed
      if (!publicId && url) {
        publicId = this.extractPublicIdFromUrl(url);
        if (publicId) {
          console.log(`Extracted publicId from URL: ${publicId}`);
        }
      }

      if (!publicId) {
        console.warn('Cannot delete image: no publicId or URL provided');
        return { success: false, error: 'No publicId available' };
      }

      // Attempt deletion
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result === 'ok' || result.result === 'not found') {
        console.log(`Deleted image: ${publicId}`);
        return { success: true };
      } else {
        console.warn(`Unexpected result deleting ${publicId}:`, result);
        return { success: false, error: result.result };
      }

    } catch (error) {
      console.error(`Error deleting image ${publicId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete image from model record
   * Handles both publicId field and URL extraction
   */
  async deleteModelImage(record, urlField, publicIdField = null) {
    const url = record[urlField];
    const publicId = publicIdField ? record[publicIdField] : null;

    if (!url && !publicId) {
      return { success: false, error: 'No image reference found' };
    }

    return await this.deleteImage(publicId, url);
  }
}

const cloudinaryService = new CloudinaryService();
module.exports = cloudinaryService;
