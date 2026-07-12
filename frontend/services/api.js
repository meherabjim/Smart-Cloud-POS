// frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api', // আপনার ব্যাকএন্ডের বেস রাউট
    headers: {
        'Content-Type': 'application/json'
    }
});

// রিকোয়েস্ট পাঠানোর আগে যদি ব্রাউজারের localStorage-এ টোকেন থাকে, তবে তা হেডার-এ যুক্ত করা
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api; // 🎯 এটি নিশ্চিত করবে যে Products.jsx-এ api.post() ঠিকঠাক কাজ করবে