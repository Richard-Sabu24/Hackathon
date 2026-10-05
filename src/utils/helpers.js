/**
 * MaskLab Utility Helpers
 */

/**
 * Sanitize user input string to prevent XSS
 * @param {string} str 
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

/**
 * Standard API response wrapper
 */
function apiResponse(success, data = null, message = null) {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  sanitizeString,
  apiResponse
};
