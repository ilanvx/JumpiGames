const express = require('express');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const { getAllAvailableItems, getAllItemsMetadata } = require('./itemsLoader');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    try {
        // Get username from session
        const username = req.session?.username;
        if (!username) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Check if user exists and is admin (case-insensitive)
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        next();
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /admin/toggle-admin: Toggle admin status for a user
router.post('/toggle-admin', requireAdmin, async (req, res) => {
    const { username, isAdmin } = req.body;
    if (!username || typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }
    try {
        // Find user with case-insensitive username comparison
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.isAdmin = isAdmin;
        await user.save();
        res.json({ success: true, message: `User ${username} is now ${isAdmin ? 'an admin' : 'not an admin'}` });
    } catch (error) {
        console.error('Error updating admin status:', error);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
});

// GET /admin/item-editor: Serves the HTML page (admin auth required)
router.get('/item-editor', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'item-editor.html'));
});

// GET /admin/players-online: Returns currently connected players
router.get('/players-online', requireAdmin, (req, res) => {
    // Access the players object from server.js
    const players = req.app.locals.players || {};
    const usernames = req.app.locals.usernames || {};
    
    const onlinePlayers = Object.keys(players).map(socketId => ({
        username: players[socketId].username,
        socketId: socketId
    }));
    
    res.json(onlinePlayers);
});

// GET /admin/users: Returns all registered users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}, 'username banned');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /admin/available-items: Returns all available items
router.get('/available-items', requireAdmin, (req, res) => {
    try {
        const items = getAllAvailableItems();
        res.json({ success: true, items: items });
    } catch (error) {
        console.error('Error fetching available items:', error);
        // Return empty array with success flag instead of 500 error
        res.json({ success: true, items: [] });
    }
});

// POST /admin/ban-user: Ban or unban a user
router.post('/ban-user', requireAdmin, async (req, res) => {
    const { username, ban } = req.body;
    
    if (!username || typeof ban !== 'boolean') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    try {
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.banned = ban;
        await user.save();
        // Disconnect if online and banned
        const players = req.app.locals.players || {};
        const usernames = req.app.locals.usernames || {};
        const targetSocketId = usernames[username];
        if (ban && targetSocketId && players[targetSocketId]) {
            req.app.get('io').to(targetSocketId).emit('banned', { message: 'Your account has been banned.' });
            req.app.get('io').sockets.sockets.get(targetSocketId)?.disconnect(true);
        }
        res.json({ success: true, message: `User ${username} ${ban ? 'banned' : 'unbanned'} successfully` });
    } catch (error) {
        console.error('Error updating user ban status:', error);
        res.status(500).json({ error: 'Failed to update user ban status' });
    }
});

// POST /admin/change-password: Change user password
router.post('/change-password', requireAdmin, async (req, res) => {
    const { username, newPassword } = req.body;
    
    if (!username || !newPassword) {
        return res.status(400).json({ error: 'Username and new password are required' });
    }
    
    try {
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        user.password = hashedPassword;
        await user.save();
        
        res.json({ success: true, message: `Password updated for user ${username}` });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// POST /admin/give-item: Give an item to a user
router.post('/give-item', requireAdmin, async (req, res) => {
    const { username, category, itemId } = req.body;
    
    if (!username || !category || !itemId) {
        return res.status(400).json({ error: 'Username, category, and itemId are required' });
    }
    
    try {
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Initialize inventory if it doesn't exist
        if (!user.inventory) {
            user.inventory = {};
        }
        
        // Initialize category array if it doesn't exist
        if (!user.inventory[category]) {
            user.inventory[category] = [];
        }
        
        const numericItemId = parseInt(itemId);
        if (isNaN(numericItemId)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }
        
        // Check if user already has this item
        if (user.inventory[category].includes(numericItemId)) {
            return res.json({ 
                success: true, 
                message: `User ${username} already has item ${category}:${numericItemId}` 
            });
        }
        
        // Add item to user's inventory
        user.inventory[category].push(numericItemId);
        user.markModified('inventory');
        await user.save();
        
        res.json({ 
            success: true, 
            message: `Item ${category}:${numericItemId} given to user ${username}` 
        });
    } catch (error) {
        console.error('Error giving item:', error);
        res.status(500).json({ error: 'Failed to give item' });
    }
});

// Store management routes
// GET /admin/store-items: Get all store items
router.get('/store-items', requireAdmin, (req, res) => {
    try {
        // Get store items from the server's storeItems array
        const storeItems = global.storeItems || [];
        res.json({ success: true, items: storeItems });
    } catch (error) {
        console.error('Error fetching store items:', error);
        res.status(500).json({ error: 'Failed to fetch store items' });
    }
});

// POST /admin/store-items: Add a new store item
router.post('/store-items', requireAdmin, async (req, res) => {
    const { itemId, category, name, price, currency } = req.body;
    
    if (!itemId || !category || !name || !price || !currency) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (price <= 0) {
        return res.status(400).json({ error: 'Price must be positive' });
    }
    
    if (!['coins', 'diamonds'].includes(currency)) {
        return res.status(400).json({ error: 'Invalid currency' });
    }
    
    try {
        // Initialize global storeItems if it doesn't exist
        if (!global.storeItems) {
            global.storeItems = [];
        }
        
        // Check if item already exists
        const existingItem = global.storeItems.find(item => 
            item.id === itemId && item.category === category
        );
        
        if (existingItem) {
            return res.status(400).json({ error: 'Item already exists in store' });
        }
        
        // Add the new item
        const newItem = { id: itemId, category, name, price, currency };
        global.storeItems.push(newItem);
        
        res.json({ 
            success: true, 
            message: `Item ${name} added to store successfully`,
            item: newItem
        });
    } catch (error) {
        console.error('Error adding store item:', error);
        res.status(500).json({ error: 'Failed to add store item' });
    }
});

// DELETE /admin/store-items: Remove a store item
router.delete('/store-items', requireAdmin, async (req, res) => {
    const { itemId, category } = req.body;
    
    if (!itemId || !category) {
        return res.status(400).json({ error: 'Item ID and category are required' });
    }
    
    try {
        // Initialize global storeItems if it doesn't exist
        if (!global.storeItems) {
            global.storeItems = [];
        }
        
        // Find and remove the item
        const itemIndex = global.storeItems.findIndex(item => 
            item.id === itemId && item.category === category
        );
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found in store' });
        }
        
        const removedItem = global.storeItems.splice(itemIndex, 1)[0];
        
        res.json({ 
            success: true, 
            message: `Item ${removedItem.name} removed from store successfully`,
            removedItem: removedItem
        });
    } catch (error) {
        console.error('Error removing store item:', error);
        res.status(500).json({ error: 'Failed to remove store item' });
    }
});

// POST /admin/add-diamonds: Add diamonds to a user
router.post('/add-diamonds', requireAdmin, async (req, res) => {
    const { username, amount } = req.body;
    if (!username || typeof amount !== 'number' || amount <= 0 || amount > 100) {
        return res.status(400).json({ error: 'Invalid parameters (max 100 diamonds per operation)' });
    }
    try {
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.diamonds = (user.diamonds || 0) + amount;
        await user.save();
        res.json({ success: true, message: `Added ${amount} diamonds to ${username}. Total: ${user.diamonds}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add diamonds' });
    }
});

// POST /admin/emit-store-update: Emit store update to all connected clients
router.post('/emit-store-update', requireAdmin, (req, res) => {
    try {
        // Emit to all connected clients via Socket.IO
        if (global.io) {
            global.io.emit('storeItemsUpdated', global.storeItems || []);
            console.log('Store update emitted to all clients');
        }
        
        res.json({ success: true, message: 'Store update emitted successfully' });
    } catch (error) {
        console.error('Error emitting store update:', error);
        res.status(500).json({ error: 'Failed to emit store update' });
    }
});

// Helper function to load item offsets
function loadItemOffsets() {
    const offsetsPath = path.join(__dirname, 'config', 'itemOffsets.json');
    try {
        if (fs.existsSync(offsetsPath)) {
            const data = fs.readFileSync(offsetsPath, 'utf8');
            return JSON.parse(data);
        } else {
            // Create default structure
            const defaultOffsets = {
                ht: {}, ps: {}, st: {}, gs: {}, nk: {}, sz: {}, sk: {}, hd: {}, hr: {}
            };
            fs.writeFileSync(offsetsPath, JSON.stringify(defaultOffsets, null, 2));
            return defaultOffsets;
        }
    } catch (error) {
        console.error('Error loading item offsets:', error);
        return {
            ht: {}, ps: {}, st: {}, gs: {}, nk: {}, sz: {}, sk: {}, hd: {}, hr: {}
        };
    }
}

// Helper function to save item offsets
function saveItemOffsets(offsets) {
    const offsetsPath = path.join(__dirname, 'config', 'itemOffsets.json');
    try {
        fs.writeFileSync(offsetsPath, JSON.stringify(offsets, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving item offsets:', error);
        return false;
    }
}

// GET /admin/item-offsets: Returns the JSON of all current offsets
router.get('/item-offsets', (req, res) => {
    try {
        const offsets = loadItemOffsets();
        res.json({ success: true, offsets: offsets });
    } catch (error) {
        console.error('Error loading item offsets:', error);
        res.status(500).json({ error: 'Failed to load item offsets' });
    }
});

// POST /admin/save-offset: Receives the offset data and updates the JSON file
router.post('/save-offset', requireAdmin, (req, res) => {
    const { category, itemId, direction, offset, applyToAll, applyToCurrentDirection } = req.body;
    
    // Validate input
    if (!category || !direction || !offset) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Validate offset values with defaults
    const x = typeof offset.x === 'number' ? offset.x : 0;
    const y = typeof offset.y === 'number' ? offset.y : 0;
    const width = typeof offset.width === 'number' ? offset.width : 1;
    const height = typeof offset.height === 'number' ? offset.height : 1;
    
    // Validate ranges
    if (width <= 0 || width > 5) {
        return res.status(400).json({ error: 'Invalid width value (must be 0.1-5)' });
    }
    
    if (height <= 0 || height > 5) {
        return res.status(400).json({ error: 'Invalid height value (must be 0.1-5)' });
    }
    
    // Sanitize input
    const validCategories = ['ht', 'ps', 'st', 'gs', 'nk', 'hd', 'sk', 'hr'];
    const validDirections = ['front', 'back', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'];
    
    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    if (!validDirections.includes(direction)) {
        return res.status(400).json({ error: 'Invalid direction' });
    }
    
    try {
        const offsets = loadItemOffsets();
        
        // Initialize category if it doesn't exist
        if (!offsets[category]) {
            offsets[category] = {};
        }
        
        const offsetData = { x, y, width, height };
        
        if (applyToAll) {
            // Apply to all items in the category for ALL directions
            const itemsMetadata = getAllItemsMetadata();
            const categoryItems = itemsMetadata[category] || {};
            const allDirections = ['front', 'back', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'];
            
            for (const itemId in categoryItems) {
                const numericItemId = parseInt(itemId);
                if (!isNaN(numericItemId) && numericItemId > 0) {
                    if (!offsets[category][numericItemId]) {
                        offsets[category][numericItemId] = {};
                    }
                    
                    // Apply the same offset to all directions
                    for (const dir of allDirections) {
                        offsets[category][numericItemId][dir] = {
                            x: offsetData.x,
                            y: offsetData.y,
                            width: offsetData.width,
                            height: offsetData.height
                        };
                    }
                }
            }
            
            if (saveItemOffsets(offsets)) {
                res.json({ 
                    success: true, 
                    message: `Offsets updated for all items in '${category}' (all directions)` 
                });
            } else {
                res.status(500).json({ error: 'Failed to save offsets' });
            }
        } else if (applyToCurrentDirection) {
            // Apply to all items in the category for CURRENT direction only
            const itemsMetadata = getAllItemsMetadata();
            const categoryItems = itemsMetadata[category] || {};
            
            for (const itemId in categoryItems) {
                const numericItemId = parseInt(itemId);
                if (!isNaN(numericItemId) && numericItemId > 0) {
                    if (!offsets[category][numericItemId]) {
                        offsets[category][numericItemId] = {};
                    }
                    
                    // Apply the same offset only to the current direction
                    offsets[category][numericItemId][direction] = {
                        x: offsetData.x,
                        y: offsetData.y,
                        width: offsetData.width,
                        height: offsetData.height
                    };
                }
            }
            
            if (saveItemOffsets(offsets)) {
                res.json({ 
                    success: true, 
                    message: `Offsets updated for all items in '${category}' (${direction} direction only)` 
                });
            } else {
                res.status(500).json({ error: 'Failed to save offsets' });
            }
        } else {
            // Apply to specific item only
            if (!itemId && !(applyToAll || applyToCurrentDirection)) {
                return res.status(400).json({ error: 'Item ID required for specific item update' });
            }
            if (applyToAll || applyToCurrentDirection) {
                // This block should never run if either applyToAll or applyToCurrentDirection is true
                // (handled above), but just in case, return success
                return res.json({ success: true, message: 'No itemId needed for bulk update' });
            }
            const numericItemId = parseInt(itemId);
            if (isNaN(numericItemId) || numericItemId <= 0) {
                return res.status(400).json({ error: 'Invalid item ID' });
            }
            if (!offsets[category][numericItemId]) {
                offsets[category][numericItemId] = {};
            }
            // Ensure all properties are saved
            offsets[category][numericItemId][direction] = {
                x: offsetData.x,
                y: offsetData.y,
                width: offsetData.width,
                height: offsetData.height
            };
            if (saveItemOffsets(offsets)) {
                res.json({ 
                    success: true, 
                    message: `Offset updated for item ${numericItemId} in '${category}' (${direction})` 
                });
            } else {
                res.status(500).json({ error: 'Failed to save offset' });
            }
        }
    } catch (error) {
        console.error('Error saving offset:', error);
        res.status(500).json({ error: 'Failed to save offset' });
    }
});

// POST /admin/reset-offsets: Reset offsets for all items in a category and direction
router.post('/reset-offsets', requireAdmin, (req, res) => {
    const { category, direction } = req.body;
    
    // Validate input
    if (!category || !direction) {
        return res.status(400).json({ error: 'Category and direction are required' });
    }
    
    // Sanitize input
    const validCategories = ['ht', 'ps', 'st', 'gs', 'nk', 'hd', 'sk', 'hr'];
    const validDirections = ['front', 'back', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'];
    
    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    if (!validDirections.includes(direction)) {
        return res.status(400).json({ error: 'Invalid direction' });
    }
    
    try {
        const offsets = loadItemOffsets();
        
        if (!offsets[category]) {
            return res.json({ 
                success: true, 
                message: `No offsets found for category '${category}'` 
            });
        }
        
        let resetCount = 0;
        
        // Remove the specific direction from all items in the category
        for (const itemId in offsets[category]) {
            if (offsets[category][itemId] && offsets[category][itemId][direction]) {
                delete offsets[category][itemId][direction];
                resetCount++;
                
                // If the item has no more directions, remove the entire item entry
                if (Object.keys(offsets[category][itemId]).length === 0) {
                    delete offsets[category][itemId];
                }
            }
        }
        
        // If the category has no more items, remove the entire category
        if (Object.keys(offsets[category]).length === 0) {
            delete offsets[category];
        }
        
        if (saveItemOffsets(offsets)) {
            res.json({ 
                success: true, 
                message: `Reset ${resetCount} offset(s) for category '${category}' (${direction})` 
            });
        } else {
            res.status(500).json({ error: 'Failed to save offsets' });
        }
    } catch (error) {
        console.error('Error resetting offsets:', error);
        res.status(500).json({ error: 'Failed to reset offsets' });
    }
});

module.exports = router; 