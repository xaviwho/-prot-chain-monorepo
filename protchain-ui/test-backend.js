// Test script for backend API
const axios = require('axios');

// This is a test token - in a real scenario, you would get this from logging in
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJleHAiOjE3NTU3NTg2MjJ9.5DjVrC8b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5';

console.log('Testing backend API with token:', token.substring(0, 20) + '...');

// Test the backend directly
axios.get('http://localhost:8082/api/v1/workflows', { 
  headers: { 
    'Authorization': 'Bearer ' + token 
  } 
})
.then(response => {
  console.log('Success:');
  console.log('Status:', response.status);
  console.log('Data:', response.data);
})
.catch(error => {
  console.error('Error:');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else {
    console.error('Message:', error.message);
  }
});
