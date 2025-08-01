/**
 * Path utility functions for consistent path handling across different environments
 */
import path from 'path';
import os from 'os';

/**
 * Normalizes a path to use the correct path separators for the current OS
 * This ensures consistent path handling across Windows and Unix-like systems
 * 
 * @param {string} inputPath - The path to normalize
 * @returns {string} - Normalized path with correct separators
 */
export function normalizePath(inputPath) {
  if (!inputPath) return '';
  
  // First, convert all separators to the OS-specific separator
  const normalized = path.normalize(inputPath);
  
  // For logging or display purposes, ensure consistent format
  return normalized;
}

/**
 * Joins path segments using the correct separator for the current OS
 * 
 * @param {...string} segments - Path segments to join
 * @returns {string} - Joined path with correct separators
 */
export function joinPaths(...segments) {
  return normalizePath(path.join(...segments));
}

/**
 * Gets the base path for workflows with environment variable fallback
 * 
 * @returns {string} - Base path for workflow operations
 */
export function getWorkflowBasePath() {
  // Default to the 'uploads' directory at the monorepo root.
  // process.cwd() in a Next.js app is the project root (e.g., /path/to/protchain-ui).
  // We navigate up one level to the monorepo root, then into 'uploads'.
  const defaultPath = path.join(process.cwd(), '..', 'uploads');
  const basePath = process.env.WORKFLOW_BASE_PATH || defaultPath;
  return normalizePath(basePath);
}

/**
 * Gets the full path to a workflow directory
 * 
 * @param {string} workflowId - The workflow ID
 * @returns {string} - Full path to the workflow directory
 */
export function getWorkflowPath(workflowId) {
  return joinPaths(getWorkflowBasePath(), workflowId);
}

/**
 * Gets the full path to a file within a workflow directory
 * 
 * @param {string} workflowId - The workflow ID
 * @param {string} filename - The filename
 * @returns {string} - Full path to the file
 */
export function getWorkflowFilePath(workflowId, filename) {
  return joinPaths(getWorkflowPath(workflowId), filename);
}
