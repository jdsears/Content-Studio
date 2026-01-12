// API client for Railway PostgreSQL backend

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';

async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Posts
  async getPosts() {
    try {
      return await fetchApi('/posts');
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  },

  async createPost(post) {
    try {
      return await fetchApi('/posts', {
        method: 'POST',
        body: JSON.stringify(post),
      });
    } catch (error) {
      console.error('Error creating post:', error);
      return null;
    }
  },

  async updatePost(id, updates) {
    try {
      return await fetchApi(`/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Error updating post:', error);
      return null;
    }
  },

  async deletePost(id) {
    try {
      await fetchApi(`/posts/${id}`, { method: 'DELETE' });
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    }
  },

  // Performance
  async getPerformance() {
    try {
      return await fetchApi('/performance');
    } catch (error) {
      console.error('Error fetching performance:', error);
      return [];
    }
  },

  async logPerformance(record) {
    try {
      return await fetchApi('/performance', {
        method: 'POST',
        body: JSON.stringify(record),
      });
    } catch (error) {
      console.error('Error logging performance:', error);
      return null;
    }
  },

  // Settings
  async getSettings() {
    try {
      return await fetchApi('/settings');
    } catch (error) {
      console.error('Error fetching settings:', error);
      return null;
    }
  },

  async saveSettings(settings) {
    try {
      return await fetchApi('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      return null;
    }
  },
};

// Check if backend is available
export async function checkBackendAvailable() {
  try {
    const response = await fetch(`${API_BASE}/settings`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
