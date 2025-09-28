// Backend API client
const API_BASE = 'http://localhost:3001/api';

class ApiClient {
  private async request(path: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include', // Include cookies for session
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok && response.status !== 401) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async createPlexPin(clientId?: string) {
    return this.request('/auth/plex/pin', {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  }

  async checkPlexPin(pinId: number, clientId: string) {
    return this.request(`/auth/plex/pin/${pinId}?clientId=${clientId}`);
  }

  async getSession() {
    try {
      return await this.request('/auth/session');
    } catch {
      return { authenticated: false };
    }
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getServers() {
    return this.request('/auth/servers');
  }

  async validateSession() {
    return this.request('/auth/validate');
  }
}

export const apiClient = new ApiClient();

// Helper to check if user is authenticated
export async function checkAuth(): Promise<boolean> {
  try {
    const session = await apiClient.getSession();
    return session.authenticated === true;
  } catch {
    return false;
  }
}

// Helper to get current user
export async function getCurrentUser() {
  try {
    const session = await apiClient.getSession();
    if (session.authenticated) {
      return session.user;
    }
    return null;
  } catch {
    return null;
  }
}