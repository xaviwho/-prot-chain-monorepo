// Centralized JWT configuration to ensure consistency across all routes
export const JWT_CONFIG = {
  // Use a consistent secret across all authentication operations
  secret: process.env.JWT_SECRET || 'protchain-development-secret-key-2024',
  
  // Token expiration settings
  expiresIn: '7d',
  
  // Algorithm for signing
  algorithm: 'HS256'
};

// Helper function to get consistent JWT secret
export function getJWTSecret() {
  return JWT_CONFIG.secret;
}

// Helper function to get JWT options
export function getJWTOptions() {
  return {
    expiresIn: JWT_CONFIG.expiresIn,
    algorithm: JWT_CONFIG.algorithm
  };
}
