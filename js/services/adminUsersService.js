/**
 * Admin Users Service
 * Handles all admin user management operations
 */

class AdminUsersService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get all admin users
   * @returns {Promise<Array>} Array of admin users
   */
  async getAllUsers() {
    try {
      const { data, error } = await this.supabase
        .from('admin_users')
        .select('*, centers(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin users:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  /**
   * Create a new admin user
   * @param {Object} userData - User data
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email
   * @param {string} userData.password - Password (plain text)
   * @param {string} userData.role - Role (admin/staff)
   * @returns {Promise<Object>} Created user data
   */
  async createUser(userData) {
    try {
      const { username, email, password, role = 'staff', center_id } = userData;

      // Validate required fields
      if (!username || !email || !password) {
        throw new Error('Username, email, and password are required');
      }

      // Validate role
      if (!['admin', 'staff'].includes(role)) {
        throw new Error('Role must be either admin or staff');
      }

      // Check if username already exists
      const { data: existingUser } = await this.supabase
        .from('admin_users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Check if email already exists
      const { data: existingEmail } = await this.supabase
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Create user in admin_users table
      const { data, error } = await this.supabase
        .from('admin_users')
        .insert([{
          username,
          email,
          password, // Store as plain text as requested
          role,
          center_id,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating admin user:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  /**
   * Update an admin user
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated user data
   */
  async updateUser(userId, updateData) {
    try {
      // If username is being updated, check if it already exists (excluding current user)
      if (updateData.username) {
        const { data: existingUser } = await this.supabase
          .from('admin_users')
          .select('id')
          .eq('username', updateData.username)
          .neq('id', userId)
          .single();

        if (existingUser) {
          throw new Error('Username already exists');
        }
      }

      // If email is being updated, check if it already exists (excluding current user)
      if (updateData.email) {
        const { data: existingEmail } = await this.supabase
          .from('admin_users')
          .select('id')
          .eq('email', updateData.email)
          .neq('id', userId)
          .single();

        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }

      const { data, error } = await this.supabase
        .from('admin_users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating admin user:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  }

  /**
   * Delete/deactivate an admin user
   * @param {string} userId - User ID
   * @param {boolean} permanent - Whether to permanently delete or just deactivate
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(userId, permanent = false) {
    try {
      if (permanent) {
        // Permanently delete user
        const { error } = await this.supabase
          .from('admin_users')
          .delete()
          .eq('id', userId);

        if (error) {
          console.error('Error deleting admin user:', error);
          throw error;
        }
      } else {
        // Deactivate user
        const { error } = await this.supabase
          .from('admin_users')
          .update({ is_active: false })
          .eq('id', userId);

        if (error) {
          console.error('Error deactivating admin user:', error);
          throw error;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async getUserById(userId) {
    try {
      const { data, error } = await this.supabase
        .from('admin_users')
        .select('*, centers(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching admin user:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserById:', error);
      throw error;
    }
  }

  /**
   * Search users by username or email
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching users
   */
  async searchUsers(searchTerm) {
    try {
      const { data, error } = await this.supabase
        .from('admin_users')
        .select('*')
        .or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching admin users:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchUsers:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   * @param {string} role - Role (admin/staff)
   * @returns {Promise<Array>} Array of users with specified role
   */
  async getUsersByRole(role) {
    try {
      const { data, error } = await this.supabase
        .from('admin_users')
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users by role:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUsersByRole:', error);
      throw error;
    }
  }

  /**
   * Get active users count
   * @returns {Promise<number>} Count of active users
   */
  async getActiveUsersCount() {
    try {
      const { count, error } = await this.supabase
        .from('admin_users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) {
        console.error('Error getting active users count:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getActiveUsersCount:', error);
      throw error;
    }
  }

  /**
   * Validate user credentials
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} User data if valid, null if invalid
   */
  async validateCredentials(username, password) {
    try {
      const { data, error } = await this.supabase
        .from('admin_users')
        .select('*, centers(*)')
        .eq('username', username)
        .eq('password', password)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error validating credentials:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in validateCredentials:', error);
      return null;
    }
  }
}

// Export the service class
window.AdminUsersService = AdminUsersService;

