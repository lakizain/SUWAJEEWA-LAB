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
        .select('*, admin_user_centers(center_id, centers(id, center_name))')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin users:', error);
        throw error;
      }

      return (data || []).map((user) => this.includeAssignedCenters(user));
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  includeAssignedCenters(user) {
    const assignedCenters = (user.admin_user_centers || [])
      .map((assignment) => assignment.centers)
      .filter(Boolean);
    if (assignedCenters.length === 0 && user.centers) {
      assignedCenters.push(user.centers);
    }
    const centerIds = (user.admin_user_centers || [])
      .map((assignment) => assignment.center_id)
      .filter(Boolean);
    if (centerIds.length === 0 && user.center_id) {
      centerIds.push(user.center_id);
    }
    return {
      ...user,
      assigned_centers: assignedCenters,
      center_ids: [...new Set(centerIds)],
    };
  }

  async setUserCenters(userId, centerIds) {
    const { error } = await this.supabase.rpc('set_admin_user_centers', {
      p_admin_user_id: userId,
      p_center_ids: [...new Set((centerIds || []).filter(Boolean))],
    });
    if (error) {
      console.error('Error setting admin user centers:', error);
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
      const { username, email, password, role = 'staff', center_ids = [], center_id = null } = userData;

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

      const assignedCenterIds = [...new Set(center_ids.filter(Boolean))];
      if (role === 'staff' && (!center_id || !assignedCenterIds.includes(center_id))) {
        throw new Error('Main center must be one of the authorized centers');
      }

      const { data, error } = await this.supabase
        .from('admin_users')
        .insert([{
          username,
          email,
          password, // Store as plain text as requested
          role,
          center_id: role === 'admin' ? null : center_id,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating admin user:', error);
        throw error;
      }

      try {
        await this.setUserCenters(data.id, assignedCenterIds);
      } catch (assignmentError) {
        const { error: cleanupError } = await this.supabase
          .from('admin_users')
          .delete()
          .eq('id', data.id);
        if (cleanupError) {
          console.error('Failed to remove user after center assignment failed:', cleanupError);
        }
        throw assignmentError;
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
      const nextData = { ...updateData };
      const shouldUpdateCenters = Array.isArray(nextData.center_ids);
      const centerIds = shouldUpdateCenters
        ? [...new Set(nextData.center_ids.filter(Boolean))]
        : null;
      delete nextData.center_ids;
      if (shouldUpdateCenters) {
        const mainCenterId = nextData.center_id || null;
        if (nextData.role === 'staff' && (!mainCenterId || !centerIds.includes(mainCenterId))) {
          throw new Error('Main center must be one of the authorized centers');
        }
        nextData.center_id = nextData.role === 'admin' ? null : mainCenterId;
      }

      // If username is being updated, check if it already exists (excluding current user)
      if (nextData.username) {
        const { data: existingUser } = await this.supabase
          .from('admin_users')
          .select('id')
          .eq('username', nextData.username)
          .neq('id', userId)
          .single();

        if (existingUser) {
          throw new Error('Username already exists');
        }
      }

      // If email is being updated, check if it already exists (excluding current user)
      if (nextData.email) {
        const { data: existingEmail } = await this.supabase
          .from('admin_users')
          .select('id')
          .eq('email', nextData.email)
          .neq('id', userId)
          .single();

        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }

      const { data, error } = await this.supabase
        .from('admin_users')
        .update(nextData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating admin user:', error);
        throw error;
      }

      if (shouldUpdateCenters) {
        await this.setUserCenters(userId, centerIds);
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
        .select('*, admin_user_centers(center_id, centers(id, center_name))')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching admin user:', error);
        throw error;
      }

      return this.includeAssignedCenters(data);
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
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Credential lookup failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(
          `Login database lookup failed${error.code ? ` (${error.code})` : ''}: ${error.message}`
        );
      }

      if (!data) return null;

      const { data: assignments, error: assignmentError } = await this.supabase
        .from('admin_user_centers')
        .select('center_id')
        .eq('admin_user_id', data.id);

      if (assignmentError) {
        console.error('Center assignment lookup failed:', {
          message: assignmentError.message,
          code: assignmentError.code,
          details: assignmentError.details,
          hint: assignmentError.hint,
        });
        throw new Error(
          `Center assignment lookup failed${assignmentError.code ? ` (${assignmentError.code})` : ''}: ${assignmentError.message}`
        );
      }

      const centerIds = [...new Set([
        ...(assignments || []).map((assignment) => assignment.center_id),
        ...(data.center_id ? [data.center_id] : []),
      ].filter(Boolean))];

      let assignedCenters = [];
      if (centerIds.length > 0) {
        const { data: centers, error: centersError } = await this.supabase
          .from('centers')
          .select('*')
          .in('id', centerIds);

        if (centersError) {
          console.error('Assigned center details lookup failed:', {
            message: centersError.message,
            code: centersError.code,
            details: centersError.details,
            hint: centersError.hint,
          });
          throw new Error(
            `Assigned center lookup failed${centersError.code ? ` (${centersError.code})` : ''}: ${centersError.message}`
          );
        }
        assignedCenters = centers || [];
      }

      return {
        ...data,
        center_ids: centerIds,
        assigned_centers: assignedCenters,
        centers: assignedCenters.find((center) => center.id === data.center_id) || null,
      };
    } catch (error) {
      console.error('Credential validation could not be completed:', error.message || error);
      throw error;
    }
  }
}

// Export the service class
window.AdminUsersService = AdminUsersService;
