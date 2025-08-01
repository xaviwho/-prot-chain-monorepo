import axios from 'axios';
import cuid from 'cuid';
import Cookies from 'js-cookie';
import { getValidToken, isValidJWT, clearAllTokens } from './tokenUtils';

// Define default URLs based on environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
const IPFS_API_URL = process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001';
const IPFS_GATEWAY_URL = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'http://localhost:8080';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Request-Source': 'protchain-client',
        'X-Request-ID': cuid()
    },
    withCredentials: false
});

// Export URLs for use in components
export const getIpfsApiUrl = () => IPFS_API_URL;
export const getIpfsGatewayUrl = () => IPFS_GATEWAY_URL;

apiClient.interceptors.request.use((config) => {
    // Use our utility function to get a valid token
    const token = getValidToken();
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        // Only log if we're in the browser to avoid SSR warnings
        if (typeof window !== 'undefined') {
            console.debug('No valid token found for API request');
        }
    }
    
    return config;
});

export const authenticateUser = async (email, password) => {
    try {
        // Call the backend API directly
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Authentication failed');
        }
        
        const data = await response.json();
        
        if (data.payload?.token) {
            // Validate token format before storing
            if (!isValidJWT(data.payload.token)) {
                console.error('Invalid JWT format received from server');
                throw new Error('Invalid token format received from server');
            }
            
            // Store token in both localStorage and cookies for compatibility
            localStorage.setItem('token', data.payload.token);
            Cookies.set('token', data.payload.token, { 
                expires: 7, // 7 days
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax'
            });
            // Trigger storage event for Navigation component
            window.dispatchEvent(new Event('storage'));
        }
        return data;
    } catch (error) {
        console.error("Login error:", error);
        throw error; // Pass through the actual error message
    }
};

export const registerUser = async (name, email, password) => {
    try {
        // Call the backend API directly
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Registration failed');
        }
        
        const data = await response.json();
        
        if (data.payload?.token) {
            // Validate token format before storing
            if (!isValidJWT(data.payload.token)) {
                console.error('Invalid JWT format received from server');
                throw new Error('Invalid token format received from server');
            }
            
            // Store token in both localStorage and cookies for compatibility
            localStorage.setItem('token', data.payload.token);
            Cookies.set('token', data.payload.token, { 
                expires: 7, // 7 days
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax'
            });
            // Trigger storage event for Navigation component
            window.dispatchEvent(new Event('storage'));
        }
        return data;
    } catch (error) {
        console.error("Registration error:", error);
        throw error; // Pass through the actual error message
    }
};

export const logoutUser = () => {
    // Use the utility function to clear tokens from all storages
    clearAllTokens();
    
    // Trigger storage event for Navigation component
    window.dispatchEvent(new Event('storage'));
    window.location.href = '/login';
};

export const retrieveProteinDetail = async (proteinId) => {
    try {
        // Send request to retrieve protein details
        console.log('Fetching protein:', proteinId);
        const response = await apiClient.get(
            `/api/v1/protein/${proteinId}`,
            {
                headers: { Accept: 'application/json' },
            }
        );

        const { data: responseData } = response;
        console.log('API Response:', responseData);
        
        if (!responseData || !responseData.data || !responseData.file) {
            throw new Error('Invalid API response format');
        }

        // Create a blob from the PDB file content
        const fileBlob = new Blob([responseData.file], { type: 'chemical/x-pdb' });

        // Return both metadata and the file blob
        return {
            metadata: {
                protein_id: responseData.protein_id,
                data: responseData.data,
                blockchain_info: responseData.blockchain_info || {
                    ipfs_cid: '',
                    file_hash: ''
                }
            },
            file: fileBlob
        };
    } catch (error) {
        console.error('Error in retrieveProteinDetail:', error);
        const errorMessage = error.response?.data?.detail || error.message || 'Network Error';
        throw new Error(errorMessage);
    }
};
