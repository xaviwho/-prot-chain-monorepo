/**
 * Utility functions for JWT token handling
 */

/**
 * Validates if a string is a properly formatted JWT token
 * @param {string} token - The token to validate
 * @returns {boolean} True if token is valid JWT format
 */
export const isValidJWT = (token) => {
  if (!token) return false;
  
  // Check if it has three parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Check if each part is base64url encoded
  try {
    // Just check if they're decodable
    atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
    atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    // Third part is signature, we don't need to decode it
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Gets a valid token from storage (cookies or localStorage)
 * @returns {string|null} The token if found and valid, null otherwise
 */
export const getValidToken = () => {
  // Try cookies first
  let token = null;
  
  // Try to import js-cookie dynamically to avoid SSR issues
  try {
    const Cookies = require('js-cookie');
    token = Cookies.get('token');
  } catch (e) {
    // Cookies not available, will try localStorage
  }
  
  // If no token in cookies or invalid, try localStorage
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }
  
  // Validate token format
  if (token && isValidJWT(token)) {
    return token;
  }
  
  return null;
};

/**
 * Clear all auth tokens from storage
 */
export const clearAllTokens = () => {
  try {
    const Cookies = require('js-cookie');
    Cookies.remove('token');
  } catch (e) {
    // Cookies not available
  }
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
};
