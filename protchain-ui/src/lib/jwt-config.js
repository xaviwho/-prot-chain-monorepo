// Centralized JWT configuration to ensure consistency across all routes
export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || null,
  expiresIn: '7d',
  algorithm: 'HS256'
};

// Helper function to get consistent JWT secret — throws if not set
export function getJWTSecret() {
  const secret = JWT_CONFIG.secret;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return secret;
}

// Helper function to get JWT options
export function getJWTOptions() {
  return {
    expiresIn: JWT_CONFIG.expiresIn,
    algorithm: JWT_CONFIG.algorithm
  };
}
