// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.adminToken = 'YOUR_SECRET_ADMIN_TOKEN';
        this.refreshInterval = null;
        this.toast = null;
        this.init();
    }

    init() {
        this.setupToast();
        this.loadData();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    setupToast() {
        this.toast = new bootstrap.Toast(document.getElementById('notificationToast'));
    }

    showNotification(title, message, type = 'info') {
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastElement = document.getElementById('notificationToast');

        toastTitle.textContent = title;
        toastMessage.textContent = message;

        // Update toast styling based on type
        toastElement.className = `toast ${type === 'error' ? 'bg-danger text-white' : type === 'success' ? 'bg-success text-white' : ''}`;

        this.toast.show();
    }

    async fetchWithAuth(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': this.adminToken
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async loadOnlinePlayers() {
        try {
            const players = await this.fetchWithAuth('/admin/players-online');
            this.renderOnlinePlayers(players);
        } catch (error) {
            console.error('Error loading online players:', error);
            this.showNotification('Error', 'Failed to load online players', 'error');
        }
    }

    async loadUsers() {
        try {
            const users = await this.fetchWithAuth('/admin/users');
            this.renderUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Error', 'Failed to load users', 'error');
        }
    }

    async loadItemsMetadata() {
        try {
            const itemsMetadata = await fetch('/api/items');
            const items = await itemsMetadata.json();
            this.renderItemsManagement(items);
        } catch (error) {
            console.error('Error loading items metadata:', error);
            this.showNotification('Error', 'Failed to load items metadata', 'error');
        }
    }
    
    async loadStoreItems() {
        try {
            const response = await this.fetchWithAuth('/admin/store-items');
            if (response.success) {
                this.renderStoreItems(response.items);
            } else {
                throw new Error(response.error || 'Failed to load store items');
            }
        } catch (error) {
            console.error('Error loading store items:', error);
            this.showNotification('Error', 'Failed to load store items', 'error');
        }
    }
    
    renderStoreItems(storeItems) {
        const tbody = document.getElementById('storeItemsBody');
        
        if (!storeItems || storeItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No store items found</td></tr>';
            return;
        }
        
        tbody.innerHTML = storeItems.map(item => `
            <tr>
                <td><code>${item.id}</code></td>
                <td><span class="badge bg-secondary">${item.category}</span></td>
                <td><strong>${item.name}</strong></td>
                <td>${item.price}</td>
                <td>
                    <span class="badge ${item.currency === 'coins' ? 'bg-warning' : 'bg-info'}">
                        <i class="fas fa-${item.currency === 'coins' ? 'coins' : 'gem'}"></i>
                        ${item.currency}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.removeStoreItem('${item.id}', '${item.category}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    async addStoreItem() {
        const itemId = document.getElementById('storeItemId').value.trim();
        const category = document.getElementById('storeItemCategory').value;
        const name = document.getElementById('storeItemName').value.trim();
        const price = parseInt(document.getElementById('storeItemPrice').value);
        const currency = document.getElementById('storeItemCurrency').value;
        
        if (!itemId || !category || !name || !price || !currency) {
            this.showNotification('Error', 'Please fill in all fields', 'error');
            return;
        }
        
        if (price <= 0) {
            this.showNotification('Error', 'Price must be positive', 'error');
            return;
        }
        
        try {
            const response = await this.fetchWithAuth('/admin/store-items', {
                method: 'POST',
                body: JSON.stringify({ itemId, category, name, price, currency })
            });
            
            if (response.success) {
                this.showNotification('Success', response.message, 'success');
                this.loadStoreItems(); // Refresh the list
                
                // Clear form
                document.getElementById('storeItemId').value = '';
                document.getElementById('storeItemCategory').value = '';
                document.getElementById('storeItemName').value = '';
                document.getElementById('storeItemPrice').value = '';
                document.getElementById('storeItemCurrency').value = 'coins';
                
                // Emit socket event to update store in real-time
                this.emitStoreUpdate();
            } else {
                this.showNotification('Error', response.error || 'Failed to add store item', 'error');
            }
            
        } catch (error) {
            console.error('Error adding store item:', error);
            this.showNotification('Error', 'Failed to add store item', 'error');
        }
    }
    
    async removeStoreItem(itemId, category) {
        if (!confirm('Are you sure you want to remove this item from the store?')) {
            return;
        }
        
        try {
            const response = await this.fetchWithAuth('/admin/store-items', {
                method: 'DELETE',
                body: JSON.stringify({ itemId, category })
            });
            
            if (response.success) {
                this.showNotification('Success', response.message, 'success');
                this.loadStoreItems(); // Refresh the list
                
                // Emit socket event to update store in real-time
                this.emitStoreUpdate();
            } else {
                this.showNotification('Error', response.error || 'Failed to remove store item', 'error');
            }
            
        } catch (error) {
            console.error('Error removing store item:', error);
            this.showNotification('Error', 'Failed to remove store item', 'error');
        }
    }
    
    // New method to emit store update to connected clients
    emitStoreUpdate() {
        // Create a simple WebSocket connection to emit the update
        const ws = new WebSocket(`ws://${window.location.host}`);
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'adminStoreUpdate',
                action: 'refresh'
            }));
            ws.close();
        };
        
        // Also try to emit via fetch to server
        fetch('/admin/emit-store-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': this.adminToken
            }
        }).catch(err => console.log('Store update emission failed:', err));
    }

    async loadData() {
        await Promise.all([
            this.loadOnlinePlayers(),
            this.loadUsers(),
            this.loadItemsMetadata(),
            this.loadStoreItems()
        ]);
        await this.loadCurrentAdminInvisibleState();
    }

    renderOnlinePlayers(players) {
        const tbody = document.getElementById('onlinePlayersBody');
        const countElement = document.getElementById('onlineCount');

        countElement.textContent = players.length;

        if (players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No players online</td></tr>';
            return;
        }

        tbody.innerHTML = players.map(player => `
            <tr>
                <td><strong>${player.username}</strong></td>
                <td><code class="text-muted">${player.socketId}</code></td>
                <td><span class="badge bg-success status-badge">Online</span></td>
            </tr>
        `).join('');
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersBody');
        const countElement = document.getElementById('totalUsersCount');

        countElement.textContent = users.length;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>
                    ${user.banned ? 
                        '<span class="badge bg-danger status-badge">Banned</span>' : 
                        '<span class="badge bg-success status-badge">Active</span>'
                    }
                </td>
                <td class="action-buttons">
                    ${user.banned ? 
                        `<button class="btn btn-sm btn-success me-1" onclick="adminPanel.toggleBan('${user.username}', false)">
                            <i class="fas fa-user-check"></i> Unban
                        </button>` :
                        `<button class="btn btn-sm btn-danger me-1" onclick="adminPanel.toggleBan('${user.username}', true)">
                            <i class="fas fa-user-slash"></i> Ban
                        </button>`
                    }
                </td>
                <td>
                    <button class="btn btn-sm ${user.isAdmin ? 'btn-warning' : 'btn-outline-warning'}" onclick="adminPanel.toggleAdmin('${user.username}', ${!user.isAdmin})">
                        <i class="fas fa-user-shield"></i> ${user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async toggleBan(username, ban) {
        try {
            const response = await this.fetchWithAuth('/admin/ban-user', {
                method: 'POST',
                body: JSON.stringify({ username, ban })
            });

            if (response.success) {
                this.showNotification('Success', response.message, 'success');
                this.loadUsers(); // Refresh the users list
            } else {
                this.showNotification('Error', response.error || 'Failed to update ban status', 'error');
            }
        } catch (error) {
            console.error('Error toggling ban:', error);
            this.showNotification('Error', 'Failed to update ban status', 'error');
        }
    }

    async toggleAdmin(username, makeAdmin) {
        try {
            const response = await this.fetchWithAuth('/admin/toggle-admin', {
                method: 'POST',
                body: JSON.stringify({ username, isAdmin: makeAdmin })
            });
            if (response.success) {
                this.showNotification('Success', response.message, 'success');
                this.loadUsers();
            } else {
                this.showNotification('Error', response.error || 'Failed to update admin status', 'error');
            }
        } catch (error) {
            console.error('Error toggling admin:', error);
            this.showNotification('Error', 'Failed to update admin status', 'error');
        }
    }

    async changePassword() {
        const username = document.getElementById('passwordUsername').value.trim();
        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        if (!username || !newPassword || !confirmPassword) {
            this.showNotification('Error', 'Please fill in all fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Error', 'Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('Error', 'Password must be at least 6 characters long', 'error');
            return;
        }

        try {
            const response = await this.fetchWithAuth('/admin/change-password', {
                method: 'POST',
                body: JSON.stringify({ username, newPassword })
            });

            if (response.success) {
                this.showNotification('Success', response.message, 'success');
                // Clear the form
                document.getElementById('passwordUsername').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            } else {
                this.showNotification('Error', response.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification('Error', 'Failed to change password', 'error');
        }
    }

    setupEventListeners() {
        // Password change button
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            this.changePassword();
        });

        // Enter key in password fields
        document.getElementById('newPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.changePassword();
            }
        });

        // Confirm password field
        document.getElementById('confirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.changePassword();
            }
        });

        // Quick action buttons
        document.getElementById('refreshDataBtn').addEventListener('click', () => {
            this.loadData();
            this.showNotification('Info', 'Data refreshed manually', 'info');
        });

        document.getElementById('exportDataBtn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('clearCacheBtn').addEventListener('click', () => {
            this.clearCache();
        });

        // Auto refresh toggle
        document.getElementById('autoRefreshToggle').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
                this.showNotification('Info', 'Auto refresh enabled', 'info');
            } else {
                this.stopAutoRefresh();
                this.showNotification('Info', 'Auto refresh disabled', 'info');
            }
        });
        
        // Store management
        document.getElementById('addStoreItemBtn').addEventListener('click', () => {
            this.addStoreItem();
        });
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.showRefreshIndicator();
            this.loadData().finally(() => {
                this.hideRefreshIndicator();
            });
        }, 10000); // Refresh every 10 seconds
    }

    showRefreshIndicator() {
        const alert = document.getElementById('refreshAlert');
        alert.style.display = 'block';
    }

    hideRefreshIndicator() {
        const alert = document.getElementById('refreshAlert');
        alert.style.display = 'none';
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    exportData() {
        try {
            const onlinePlayers = document.getElementById('onlinePlayersBody').innerHTML;
            const users = document.getElementById('usersBody').innerHTML;
            
            const exportData = {
                timestamp: new Date().toISOString(),
                onlinePlayers: onlinePlayers,
                users: users,
                onlineCount: document.getElementById('onlineCount').textContent,
                totalUsersCount: document.getElementById('totalUsersCount').textContent
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `admin-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showNotification('Success', 'Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error', 'Failed to export data', 'error');
        }
    }

    clearCache() {
        try {
            // Clear browser cache for this page
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }
            
            // Clear localStorage if any
            localStorage.clear();
            
            this.showNotification('Success', 'Cache cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showNotification('Error', 'Failed to clear cache', 'error');
        }
    }

    renderItemsManagement(itemsMetadata) {
        const categorySelect = document.getElementById('itemCategory');
        const itemsGrid = document.getElementById('itemsGrid');
        
        if (!categorySelect || !itemsGrid) return;
        
        // Populate category select
        categorySelect.innerHTML = '<option value="">Select category...</option>';
        const categories = {
            ht: 'Hats',
            ps: 'Pants',
            st: 'Shirts',
            gs: 'Glasses',
            nk: 'Necklaces',
            hd: 'Skin Colors',
            sk: 'Skateboards',
            hr: 'Hair'
        };
        Object.keys(categories).forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = categories[category];
            categorySelect.appendChild(option);
        });
        
        // Handle category selection
        categorySelect.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            if (selectedCategory) {
                this.renderItemsGrid(itemsMetadata[selectedCategory], selectedCategory);
            } else {
                itemsGrid.innerHTML = '<div class="col-12 text-center text-muted">Select a category to view items</div>';
            }
        });
    }

    renderItemsGrid(categoryItems, category) {
        const itemsGrid = document.getElementById('itemsGrid');
        if (!itemsGrid) return;
        
        const items = Object.values(categoryItems);
        if (items.length === 0) {
            itemsGrid.innerHTML = '<div class="col-12 text-center text-muted">No items found in this category</div>';
            return;
        }
        
        itemsGrid.innerHTML = items.map(item => `
            <div class="col-md-3 col-sm-4 col-6">
                <div class="card h-100 item-card">
                    <div class="card-body text-center">
                        <img src="/items/${item.category}/${item.id}/front.png" 
                             alt="${item.name}" 
                             class="img-fluid mb-2 item-thumbnail"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjMyIiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo='">
                        <h6 class="card-title">${item.name}</h6>
                        <p class="card-text small text-muted">ID: ${item.id}</p>
                        <button class="btn btn-sm btn-primary give-item-btn" 
                                data-category="${item.category}" 
                                data-item-id="${item.id}">
                            <i class="fas fa-gift"></i> Give Item
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to give item buttons
        itemsGrid.querySelectorAll('.give-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                const itemId = e.target.dataset.itemId;
                this.giveItemToUser(category, itemId);
            });
        });
    }

    getCategoryDisplayName(category) {
        const categoryNames = {
            ht: 'Hats',
            ps: 'Pants',
            st: 'Shirts',
            gs: 'Glasses',
            nk: 'Necklaces',
            hd: 'Skin Colors',
            sk: 'Skateboards',
            hr: 'Hair'
        };
        return categoryNames[category] || category;
    }

    async giveItemToUser(category, itemId) {
        const targetUsername = document.getElementById('targetUsername')?.value.trim();
        if (!targetUsername) {
            this.showNotification('Error', 'Please enter a target username', 'error');
            return;
        }
        
        try {
            const response = await this.fetchWithAuth('/admin/give-item', {
                method: 'POST',
                body: JSON.stringify({ 
                    username: targetUsername, 
                    category: category, 
                    itemId: itemId 
                })
            });
            
            if (response.success) {
                this.showNotification('Success', response.message, 'success');
            } else {
                this.showNotification('Error', response.error || 'Failed to give item', 'error');
            }
        } catch (error) {
            console.error('Error giving item:', error);
            this.showNotification('Error', 'Failed to give item', 'error');
        }
    }

    async toggleInvisibleMode() {
        try {
            const response = await this.fetchWithAuth('/admin/toggle-invisible', {
                method: 'POST'
            });
            if (response.success) {
                this.showNotification('Success', `Invisible Mode is now ${response.invisible ? 'ON' : 'OFF'}`, 'success');
                this.updateInvisibleButton(response.invisible);
            } else {
                this.showNotification('Error', response.error || 'Failed to toggle Invisible Mode', 'error');
            }
        } catch (error) {
            console.error('Error toggling Invisible Mode:', error);
            this.showNotification('Error', 'Failed to toggle Invisible Mode', 'error');
        }
    }

    updateInvisibleButton(isInvisible) {
        const btn = document.getElementById('toggleInvisibleBtn');
        if (btn) {
            btn.textContent = isInvisible ? 'Disable Invisible Mode' : 'Enable Invisible Mode';
            btn.className = isInvisible ? 'btn btn-secondary' : 'btn btn-outline-secondary';
        }
    }

    renderInvisibleButton(isInvisible) {
        // Only show if current user is admin
        const panel = document.getElementById('adminActions');
        if (!panel) return;
        let btn = document.getElementById('toggleInvisibleBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'toggleInvisibleBtn';
            btn.className = isInvisible ? 'btn btn-secondary' : 'btn btn-outline-secondary';
            btn.style.marginRight = '10px';
            btn.onclick = () => this.toggleInvisibleMode();
            panel.appendChild(btn);
        }
        this.updateInvisibleButton(isInvisible);
    }

    // Call this after loading user info (assuming current user is admin)
    async loadCurrentAdminInvisibleState() {
        // Try to get current user info from /admin/players-online and match socketId/username
        try {
            const players = await this.fetchWithAuth('/admin/players-online');
            const myUsername = localStorage.getItem('username');
            const me = players.find(p => p.username === myUsername);
            if (me && typeof me.invisible !== 'undefined') {
                this.renderInvisibleButton(me.invisible);
            }
        } catch (e) {
            // fallback: just show button as Enable
            this.renderInvisibleButton(false);
        }
    }
}

// Initialize the admin panel when the page loads
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (adminPanel) {
        adminPanel.stopAutoRefresh();
    }
}); 