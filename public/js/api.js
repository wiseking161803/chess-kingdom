/**
 * API Client — Centralized HTTP client for all API calls
 */
const API = {
    token: null,

    async request(method, url, data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' // Send cookies
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`/api${url}`, options);
            const json = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    this.token = null;
                    localStorage.removeItem('token');
                    if (typeof App !== 'undefined') App.navigate('login');
                }
                throw new Error(json.error || 'Lỗi không xác định');
            }

            return json;
        } catch (err) {
            if (err.message === 'Failed to fetch') {
                throw new Error('Không thể kết nối tới máy chủ');
            }
            throw err;
        }
    },

    get(url) { return this.request('GET', url); },
    post(url, data) { return this.request('POST', url, data); },
    put(url, data) { return this.request('PUT', url, data); },
    delete(url) { return this.request('DELETE', url); },

    // File upload
    async upload(url, formData) {
        const options = {
            method: 'POST',
            credentials: 'include',
            body: formData,
        };
        if (this.token) {
            options.headers = { 'Authorization': `Bearer ${this.token}` };
        }
        const response = await fetch(`/api${url}`, options);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Lỗi upload');
        return json;
    }
};
