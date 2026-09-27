import axiosClient from './axiosClient';

export const authApi = {
  /**
   * Log in admin user
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ token: string, user: object, raw: object }>}
   */
  async login({ email, password }) {
    const response = await axiosClient.post('/auth/admin/login', {
      email,
      password,
    });

    const data = response.data;
    // Extract token from common API structures
    const token =
      data.token ||
      data.access_token ||
      data.data?.token ||
      data.data?.access_token ||
      data.authorisation?.token ||
      data.data?.authorisation?.token;

    // Extract user info
    const user =
      data.user ||
      data.data?.user ||
      data.admin ||
      data.data?.admin ||
      { email };

    return {
      token,
      user,
      raw: data,
    };
  },

  /**
   * Admin logout
   * Using endpoint: https://smartego.keeto.org/api/auth/logout
   */
  async logout() {
    try {
      await axiosClient.post('/auth/logout');
    } catch {
      // Ignore network/server errors during logout to allow local session clearance
    }
  },

  /**
   * Fetch current admin profile
   */
  async getProfile() {
    const response = await axiosClient.get('/auth/admin/profile');
    return response.data;
  },
};

export default authApi;
