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
export const getApiBaseUrl = () => API_URL;

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
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            // Backend uses { success:false, error:"..." }
            const message = body?.error || body?.message || 'Authentication failed';
            throw new Error(message);
        }

        const token = body?.data?.token;
        if (token) {
            if (!isValidJWT(token)) {
                console.error('Invalid JWT format received from server');
                throw new Error('Invalid token format received from server');
            }
            localStorage.setItem('token', token);
            Cookies.set('token', token, {
                expires: 7,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax'
            });
            window.dispatchEvent(new Event('storage'));
        }
        return body;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

export const registerUser = async (name, email, password) => {
    try {
        // Split full name into first/last per backend expectations
        let first_name = name?.trim() || '';
        let last_name = '';
        if (first_name.includes(' ')) {
            const parts = first_name.split(/\s+/);
            first_name = parts.shift();
            last_name = parts.join(' ');
        }

        const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, first_name, last_name })
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = body?.error || body?.message || 'Registration failed';
            throw new Error(message);
        }

        const token = body?.data?.token;
        if (token) {
            if (!isValidJWT(token)) {
                console.error('Invalid JWT format received from server');
                throw new Error('Invalid token format received from server');
            }
            localStorage.setItem('token', token);
            Cookies.set('token', token, {
                expires: 7,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax'
            });
            window.dispatchEvent(new Event('storage'));
        }
        return body;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
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
        console.log('Fetching protein:', proteinId);
        const token = getValidToken();
        const res = await fetch(`/api/v1/protein/${encodeURIComponent(proteinId)}`, {
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        const text = await res.text();
        if (!res.ok) {
            let detail = 'Failed to retrieve protein';
            try { const j = JSON.parse(text); detail = j?.error || j?.message || detail; } catch (_) {}
            throw new Error(detail);
        }
        let responseData;
        try { responseData = text ? JSON.parse(text) : null; } catch (_) { throw new Error('Invalid API response format'); }
        console.log('API Response:', responseData);

        if (!responseData || !responseData.data || !responseData.file) {
            throw new Error('Invalid API response format');
        }

        const fileBlob = new Blob([responseData.file], { type: 'chemical/x-pdb' });
        return {
            metadata: {
                protein_id: responseData.protein_id,
                data: responseData.data,
                blockchain_info: responseData.blockchain_info || { ipfs_cid: '', file_hash: '' },
            },
            file: fileBlob,
        };
    } catch (error) {
        console.error('Error in retrieveProteinDetail:', error);
        const errorMessage = error.message || 'Network Error';
        throw new Error(errorMessage);
    }
};
