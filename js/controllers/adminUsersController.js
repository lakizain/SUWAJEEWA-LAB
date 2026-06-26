(function () {
  'use strict';

  const state = {
    sb: null,
    adminUsersService: null,
    centerService: null,
    editingUserId: null,
    isEditMode: false,
  };

  function $(id) { return document.getElementById(id); }
  function setStatus(text) { const el = $('status'); if (el) el.textContent = text || ''; }
  function setFormMsg(text) { const el = $('formMsg'); if (el) el.textContent = text || ''; }

  async function ensureSupabase() {
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.supabase) {
      return window.SUPABASE_CONFIG.supabase;
    }
    return new Promise(function (resolve) {
      const i = setInterval(function () {
        if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.supabase) {
          clearInterval(i);
          resolve(window.SUPABASE_CONFIG.supabase);
        }
      }, 50);
    });
  }

  async function populateCenterDropdown() {
    try {
      const centers = await state.centerService.getCentersForDropdown();
      const centerSelect = $('center');
      if (!centerSelect) return;
      
      centerSelect.innerHTML = '<option value="">-- Select Center --</option>';
      
      centers.forEach(center => {
        const option = document.createElement('option');
        option.value = center.id;
        option.textContent = center.center_name;
        centerSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error populating center dropdown:', error);
    }
  }

  function renderUsers(rows) {
    const body = $('usersBody');
    if (!body) return;
    if (!rows || rows.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="empty">No users yet</td></tr>';
      return;
    }
    const html = rows.map(function (u) {
      const roleBadge = '<span class="badge ' + (u.role === 'admin' ? 'admin' : 'staff') + '">' + (u.role || 'staff') + '</span>';
      const centerName = u.centers ? u.centers.center_name : '<span class="muted">--</span>';
      return (
        '<tr>' +
          '<td>' + (u.username || '') + '</td>' +
          '<td>' + (u.email || '') + '</td>' +
          '<td class="muted">••••••••</td>' +
          '<td>' + roleBadge + '</td>' +
          '<td>' + centerName + '</td>' +
          '<td class="actions">' +
            '<button class="btn secondary" data-action="edit" data-id="' + u.id + '">Edit</button>' +
            '<button class="btn danger" data-action="deactivate" data-id="' + u.id + '">Delete</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
    body.innerHTML = html;
  }

  async function fetchUsers() {
    setStatus('Loading users…');
    try {
      const users = await state.adminUsersService.getAllUsers();
      setStatus('');
      renderUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setStatus('Failed to load users: ' + error.message);
      renderUsers([]);
    }
  }

  function openDialog(isEdit = false, userData = null) { 
    const d = $('addUserDialog'); 
    const title = $('dialogTitle');
    const createBtn = $('btnCreate');
    
    if (d && !d.open) {
      // Set dialog mode
      state.isEditMode = isEdit;
      
      if (isEdit && userData) {
        // Edit mode
        title.textContent = 'Edit User';
        createBtn.textContent = 'Update';
        state.editingUserId = userData.id;
        
        // Populate form with existing data
        $('username').value = userData.username || '';
        $('email').value = userData.email || '';
        $('password').value = ''; // Don't show existing password
        $('role').value = userData.role || 'staff';
        $('center').value = userData.center_id || '';
        
        // Username is editable in edit mode
        $('username').readOnly = false;
      } else {
        // Add mode
        title.textContent = 'Add New User';
        createBtn.textContent = 'Create';
        state.editingUserId = null;
        
        // Clear form
        $('username').value = '';
        $('email').value = '';
        $('password').value = '';
        $('role').value = 'staff';
        $('center').value = '';
        
        // Make username editable
        $('username').readOnly = false;
      }
      
      setFormMsg('');
      d.showModal(); 
    }
  }
  
  function closeDialog() { 
    const d = $('addUserDialog'); 
    if (d && d.open) {
      d.close();
      // Reset state
      state.isEditMode = false;
      state.editingUserId = null;
      $('username').readOnly = false;
    }
  }

  async function onCreateUser(evt) {
    evt.preventDefault();
    setFormMsg('');
    const username = String(($('username') && $('username').value) || '').trim();
    const email = String(($('email') && $('email').value) || '').trim();
    const password = String(($('password') && $('password').value) || '');
    const role = String(($('role') && $('role').value) || 'staff');
    const centerValue = $('center').value;
    const center_id = centerValue || null;
    
    // Validation
    if (!username || !email) { 
      setFormMsg('Username and email are required.'); 
      return; 
    }
    
    // For edit mode, password is optional (only update if provided)
    if (!state.isEditMode && !password) {
      setFormMsg('Password is required for new users.');
      return;
    }
    
    $('btnCreate').disabled = true;
    try {
      if (state.isEditMode && state.editingUserId) {
        // Update existing user
        const updateData = {
          username,
          email,
          role,
          center_id
        };
        
        // Only update password if provided
        if (password.trim()) {
          updateData.password = password;
        }
        
        await state.adminUsersService.updateUser(state.editingUserId, updateData);
        setStatus('User updated successfully');
      } else {
        // Create new user
        const userData = {
          username,
          email,
          password,
          role,
          center_id
        };
        
        await state.adminUsersService.createUser(userData);
        setStatus('User created successfully');
      }
      
      // Clear form
      $('username').value = '';
      $('email').value = '';
      $('password').value = '';
      $('role').value = 'staff';
      $('center').value = '';
      
      closeDialog();
      await fetchUsers();
      setFormMsg('');
    } catch (error) {
      console.error('Error saving user:', error);
      setFormMsg(error.message || 'An error occurred while saving user.');
    } finally {
      $('btnCreate').disabled = false;
    }
  }

  async function onTableClick(evt) {
    const target = evt.target;
    if (!target || !target.dataset) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;
    
    if (action === 'edit') {
      try {
        // Get user data for editing
        const userData = await state.adminUsersService.getUserById(id);
        if (userData) {
          openDialog(true, userData);
        } else {
          alert('User not found');
        }
      } catch (error) {
        console.error('Error fetching user for edit:', error);
        alert('Failed to load user data: ' + error.message);
      }
    } else if (action === 'deactivate') {
      // Enhanced confirmation dialog
      const userRow = target.closest('tr');
      const username = userRow ? userRow.cells[0].textContent.trim() : 'this user';
      
      if (!confirm(`Are you sure you want to delete "${username}"?\n\nThis will deactivate the user account and they will no longer be able to log in.`)) {
        return;
      }
      
      // Disable button during operation
      target.disabled = true;
      target.textContent = 'Deleting...';
      
      try {
        await state.adminUsersService.deleteUser(id, false); // Deactivate, don't delete
        await fetchUsers();
        setStatus(`User "${username}" has been deactivated successfully`);
        
        // Clear status after 3 seconds
        setTimeout(() => setStatus(''), 3000);
      } catch (error) {
        console.error('Error deactivating user:', error);
        alert('Failed to deactivate user: ' + error.message);
        setStatus('Error: Failed to deactivate user');
      } finally {
        // Re-enable button
        target.disabled = false;
        target.textContent = 'Delete';
      }
    }
  }

  // Bills functionality
  function renderBills(bills) {
    const body = $('billsHistoryBody');
    if (!body) return;
    
    if (!bills || bills.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty"><i class="fas fa-info-circle"></i><div>No bills found</div></td></tr>';
      return;
    }
    
    const html = bills.map(function (bill) {
      const testsDisplay = state.adminBillsService ? 
        state.adminBillsService.formatTestsForDisplay(bill.bill_items) : 
        'Loading...';
      
      const paidAmount = state.adminBillsService ? 
        state.adminBillsService.formatCurrency(bill.paid_amount) : 
        `Rs. ${parseFloat(bill.paid_amount || 0).toFixed(2)}`;
      
      const remainingAmount = state.adminBillsService ? 
        state.adminBillsService.formatCurrency(bill.remaining_amount) : 
        `Rs. ${parseFloat(bill.remaining_amount || 0).toFixed(2)}`;
      
      const billDate = state.adminBillsService ? 
        state.adminBillsService.formatDate(bill.bill_date) : 
        new Date(bill.bill_date).toLocaleDateString();
        
      const remainingClass = parseFloat(bill.remaining_amount || 0) > 0 ? 'remaining' : 'amount';
      
      return (
        '<tr>' +
          '<td>' + (bill.bill_no || '') + '</td>' +
          '<td>' + (bill.patient_name || '') + '</td>' +
          '<td>' + billDate + '</td>' +
          '<td>' + (bill.patient_gender || '') + '</td>' +
          '<td>' + testsDisplay + '</td>' +
          '<td class="amount">' + paidAmount + '</td>' +
          '<td class="' + remainingClass + '">' + remainingAmount + '</td>' +
          '<td class="actions">' +
            '<button class="btn view" data-action="view-bill" data-id="' + bill.id + '">View</button>' +
            '<button class="btn print" data-action="print-bill" data-id="' + bill.id + '">Print</button>' +
            '<button class="btn delete" data-action="delete-bill" data-id="' + bill.id + '" data-bill-no="' + (bill.bill_no || '') + '">Delete</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
    
    body.innerHTML = html;
    
    // Update results counter
    const counter = $('bills-search-results-counter');
    if (counter) {
      counter.style.display = 'block';
      counter.textContent = `Found ${bills.length} result(s)`;
    }
  }
  
  async function fetchBills() {
    try {
      if (!state.adminBillsService) return;
      
      const bills = await state.adminBillsService.getAllRecentBills();
      renderBills(bills);
    } catch (error) {
      console.error('Error fetching bills:', error);
      renderBills([]);
    }
  }
  
  async function searchBills(searchTerm) {
    try {
      if (!state.adminBillsService) return;
      
      const bills = await state.adminBillsService.searchBills(searchTerm);
      renderBills(bills);
    } catch (error) {
      console.error('Error searching bills:', error);
      renderBills([]);
    }
  }
  
  async function onBillsTableClick(evt) {
    const target = evt.target;
    if (!target || !target.dataset) return;
    
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;
    
    if (action === 'view-bill') {
      try {
        const billDetails = await state.adminBillsService.getBillDetails(id);
        if (billDetails) {
          // Show bill details in a modal or navigate to bill details page
          alert(`Bill Details:\nBill No: ${billDetails.bill_no}\nPatient: ${billDetails.patient_name}\nAmount: Rs. ${billDetails.final_amount}\nStatus: ${billDetails.status}`);
        }
      } catch (error) {
        console.error('Error viewing bill:', error);
        alert('Failed to load bill details');
      }
    } else if (action === 'print-bill') {
      try {
        // This would typically open a print dialog or generate a PDF
        alert(`Print functionality for Bill ${id} would be implemented here`);
      } catch (error) {
        console.error('Error printing bill:', error);
        alert('Failed to print bill');
      }
    } else if (action === 'delete-bill') {
      const billNo = target.dataset.billNo || 'Unknown';
      await handleDeleteBill(id, billNo, target);
    }
  }
  
  async function handleDeleteBill(billId, billNo, buttonElement) {
    try {
      if (!state.adminBillsService) {
        alert('Service not available');
        return;
      }

      // Disable button during operation
      const originalText = buttonElement.textContent;
      buttonElement.disabled = true;
      buttonElement.textContent = 'Checking...';

      // Check if bill can be deleted
      const canDeleteResult = await state.adminBillsService.canDeleteBill(billId);
      
      if (!canDeleteResult.canDelete) {
        alert(`Cannot delete bill: ${canDeleteResult.reason}`);
        return;
      }

      // Show confirmation dialog with bill details
      const billDetails = canDeleteResult.billDetails;
      const confirmMessage = `Are you sure you want to delete this bill?\n\n` +
        `Bill No: ${billNo}\n` +
        `Patient: ${billDetails.patient_name || 'Unknown'}\n` +
        `Date: ${state.adminBillsService.formatDate(billDetails.bill_date)}\n` +
        `Amount: ${state.adminBillsService.formatCurrency(billDetails.final_amount)}\n\n` +
        `This action cannot be undone!`;

      if (!confirm(confirmMessage)) {
        return;
      }

      // Update button text
      buttonElement.textContent = 'Deleting...';

      // Delete the bill
      const result = await state.adminBillsService.deleteBill(billId);
      
      if (result.success) {
        // Show success message
        setStatus(result.message);
        
        // Refresh the bills list
        await fetchBills();
        
        // Clear status after 3 seconds
        setTimeout(() => setStatus(''), 3000);
      } else {
        alert('Failed to delete bill');
      }

    } catch (error) {
      console.error('Error deleting bill:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to delete bill';
      if (error.message.includes('Database connection')) {
        errorMessage = 'Cannot delete bill: Database connection not available';
      } else if (error.message.includes('not found')) {
        errorMessage = 'Cannot delete bill: Bill not found';
      } else if (error.message) {
        errorMessage = `Failed to delete bill: ${error.message}`;
      }
      
      alert(errorMessage);
      setStatus('Error: Failed to delete bill');
    } finally {
      // Re-enable button
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.textContent = 'Delete';
      }
    }
  }
  
  function setupBillsEventListeners() {
    // Search functionality
    const searchInput = $('bills-search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const searchTerm = this.value.trim();
          if (searchTerm) {
            searchBills(searchTerm);
          } else {
            fetchBills();
          }
        }, 300);
      });
    }
    
    // Clear search button
    const clearBtn = $('clear-bills-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (searchInput) {
          searchInput.value = '';
          fetchBills();
          const counter = $('bills-search-results-counter');
          if (counter) {
            counter.style.display = 'none';
          }
        }
      });
    }
    
    // Refresh button
    const refreshBtn = $('btn-refresh-bills');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        fetchBills();
        if (searchInput) {
          searchInput.value = '';
          const counter = $('bills-search-results-counter');
          if (counter) {
            counter.style.display = 'none';
          }
        }
      });
    }
    
    // Table click events
    const billsBody = $('billsHistoryBody');
    if (billsBody) {
      billsBody.addEventListener('click', onBillsTableClick);
    }
  }

  (async function init() {
    state.sb = await ensureSupabase();
    
    // Initialize admin users service
    state.adminUsersService = new window.AdminUsersService(state.sb);
    // Initialize center service
    state.centerService = new window.CenterService();
    // Initialize admin bills service
    state.adminBillsService = new window.AdminBillsService();
    
    // Populate center dropdown
    await populateCenterDropdown();
    
    // Load users and enable add functionality regardless of auth status
    fetchUsers();
    
    // Load bills
    fetchBills();
    
    // Setup event listeners
    const addBtn = $('btnAddUser'); if (addBtn) addBtn.addEventListener('click', () => openDialog(false));
    const cancelBtn = $('btnCancel'); if (cancelBtn) cancelBtn.addEventListener('click', function(){ closeDialog(); });
    const form = $('addUserForm'); if (form) form.addEventListener('submit', onCreateUser);
    const body = $('usersBody'); if (body) body.addEventListener('click', onTableClick);
    
    // Setup bills event listeners
    setupBillsEventListeners();
  })();
})();


