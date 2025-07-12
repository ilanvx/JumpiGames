// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const User = require('./models/User'); // Ensure this path is correct and User model is well-defined
const adminRoutes = require('./adminRoutes');
const storeRoutes = require('./storeRoutes');
const { getAllItemsMetadata, getItemMetadata } = require('./itemsLoader');
const emailConfig = require('./config/email');

const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);

// Define ITEM_CATEGORIES_SERVER_KEYS based on your client-side ITEM_CATEGORIES
// This helps ensure consistency in data structures.
const ITEM_CATEGORIES_SERVER_KEYS = ["ht", "ps", "st", "gs", "nk", "hd", "sk", "hr"];

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jumpi', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully.'))
.catch(err => console.error('MongoDB connection error:', err));

const sessionMiddleware = session({
 secret: 'jumpi_secret_key', // Consider a more secure, environment-variable-based secret
 resave: false,
 saveUninitialized: false,
 cookie: { secure: false } // Set to true if using HTTPS
});

app.use(express.json());
app.use(express.static('public'));
app.use(sessionMiddleware);

// Mount admin routes
app.use('/admin', adminRoutes);

// Mount store routes
app.use('/store', storeRoutes);

io.use((socket, next) => {
 sessionMiddleware(socket.request, {}, next);
});

const players = {}; // Stores current state of connected players
const usernames = {}; // Maps username to socket.id for quick lookup

// Security tracking
const securityViolations = {}; // Track violations per socket
const blockedSockets = new Set(); // Blocked socket IDs

// Room Management System
const rooms = {
    football: { id: 'football', name: 'Football Field', background: 'rooms/football.png', maxCapacity: 50, currentPlayers: 0 },
    space: { id: 'space', name: 'Space', background: 'rooms/space.png', maxCapacity: 50, currentPlayers: 0 },
    beach: { id: 'beach', name: 'Beach', background: 'rooms/sea.png', maxCapacity: 50, currentPlayers: 0 },
    park: { id: 'park', name: 'Park', background: 'rooms/park.png', maxCapacity: 50, currentPlayers: 0 }
};

// Home System
const homeRooms = {}; // Store individual home rooms: { homeId: { id: homeId, name: 'Home', background: 'rooms/house.png', maxCapacity: 1, currentPlayers: 0, owner: username } }
const playerPreviousRooms = {}; // Track previous room for each player: { socketId: previousRoomId }

// Track which room each player is in
const playerRooms = {}; // socketId -> roomId

// Make players and usernames accessible to admin routes
app.locals.players = players;
app.locals.usernames = usernames;

// Helper function to initialize player data structure
function initializePlayerData(dbUser) {
    const initialInventory = {};
    ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => {
        initialInventory[catKey] = (dbUser.inventory && Array.isArray(dbUser.inventory[catKey])) ? [...dbUser.inventory[catKey]] : [];
    });

    const initialEquipped = {};
    ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => {
        initialEquipped[catKey] = (dbUser.equipped && dbUser.equipped.hasOwnProperty(catKey)) ? dbUser.equipped[catKey] : null;
    });

    return {
        username: dbUser.username,
        x: 300,
        y: 300,
        targetX: 300,
        targetY: 300,
        direction: 'front',
        message: '',
        messageTime: 0,
        coins: (typeof dbUser.coins === 'number') ? dbUser.coins : 0,
        diamonds: (typeof dbUser.diamonds === 'number') ? dbUser.diamonds : 0,
        inventory: initialInventory,
        equipped: initialEquipped,
        id: '', // Will be set to socket.id
        isAdmin: !!dbUser.isAdmin,
        isAFK: false,
        homeId: dbUser.homeId || null
    };
}

// --- Trading System (Basic) ---
const pendingTradeRequests = [];
const activeTrades = {}; // Store active trades: { tradeId: { player1, player2, offers, locked, confirmed } }
const playersInTrade = new Set();

// --- Chat Filtering System ---
const profanityFilter = {
    // Hebrew profanity list
    hebrew: [
        'זבל', 'בן זונה', 'בת זונה', 'כוס', 'זין', 'תחת', 'זין עליך', 'כוס אמא שלך',
        'בן של זונה', 'בת של זונה', 'זבל אנושי', 'חתיכת זבל', 'בן כלבה', 'בת כלבה',
        'כלב', 'כלבה', 'זבל אנושי', 'חתיכת זבל', 'בן זונה', 'בת זונה', 'כוס אמא שלך',
        'זין עליך', 'תחת שלך', 'כוס שלך', 'זין שלך', 'בן של כלבה', 'בת של כלבה',
        'חתיכת זונה', 'בן זונה', 'בת זונה', 'כוס אמא שלך', 'זין עליך', 'תחת שלך',
        'זונה', 'כוס אמא', 'כוס אבא', 'זין אמא', 'זין אבא', 'תחת אמא', 'תחת אבא',
        'בן זונה', 'בת זונה', 'בן כלבה', 'בת כלבה', 'בן זבל', 'בת זבל',
        'כוס עליך', 'זין עליך', 'תחת עליך', 'כוס שלך', 'זין שלך', 'תחת שלך',
        'כוס אמא שלך', 'זין אמא שלך', 'תחת אמא שלך', 'כוס אבא שלך', 'זין אבא שלך',
        'כוס המשפחה שלך', 'זין המשפחה שלך', 'תחת המשפחה שלך',
        'בן של זונה', 'בת של זונה', 'בן של כלבה', 'בת של כלבה',
        'חתיכת זבל', 'חתיכת זונה', 'חתיכת כלבה', 'חתיכת זבל אנושי',
        'כוס אמא שלך', 'זין אמא שלך', 'תחת אמא שלך',
        'כוס אבא שלך', 'זין אבא שלך', 'תחת אבא שלך',
        'כוס המשפחה שלך', 'זין המשפחה שלך', 'תחת המשפחה שלך',
        'בן זונה', 'בת זונה', 'בן כלבה', 'בת כלבה', 'בן זבל', 'בת זבל',
        'כוס עליך', 'זין עליך', 'תחת עליך', 'כוס שלך', 'זין שלך', 'תחת שלך',
        'כוס אמא שלך', 'זין אמא שלך', 'תחת אמא שלך', 'כוס אבא שלך', 'זין אבא שלך',
        'כוס המשפחה שלך', 'זין המשפחה שלך', 'תחת המשפחה שלך',
        'בן של זונה', 'בת של זונה', 'בן של כלבה', 'בת של כלבה',
        'חתיכת זבל', 'חתיכת זונה', 'חתיכת כלבה', 'חתיכת זבל אנושי',
        'כוס אמא שלך', 'זין אמא שלך', 'תחת אמא שלך',
        'כוס אבא שלך', 'זין אבא שלך', 'תחת אבא שלך',
        'כוס המשפחה שלך', 'זין המשפחה שלך', 'תחת המשפחה שלך',
        'שרמוטה', 'שרמוט', 'שרמוטות', 'שרמוטים'
    ],
    // English profanity list
    english: [
        'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'cock', 'cunt', 'whore', 'slut',
        'motherfucker', 'fucker', 'bastard', 'son of a bitch', 'piece of shit', 'dumbass',
        'fucking', 'shitty', 'bitchy', 'asshole', 'dickhead', 'pussy', 'cock', 'cunt',
        'whore', 'slut', 'motherfucker', 'fucker', 'bastard', 'son of a bitch',
        'piece of shit', 'dumbass', 'fucking', 'shitty', 'bitchy', 'asshole', 'dickhead'
    ]
};

// Allowed characters for chat
const allowedChars = /^[a-zA-Z0-9\u0590-\u05FF\s!?,.()*%$#@^+-]+$/;

function filterChatMessage(message) {
    if (!message || typeof message !== 'string') {
        return { filtered: false, reason: 'Invalid message format' };
    }
    
    // Check for allowed characters only
    if (!allowedChars.test(message)) {
        return { filtered: false, reason: 'רק אותיות בעברית, אנגלית, ספרות ותווים מיוחדים מותרים' };
    }
    
    // Convert to lowercase for checking
    const lowerMessage = message.toLowerCase();
    
    // Check Hebrew profanity
    for (const word of profanityFilter.hebrew) {
        if (lowerMessage.includes(word.toLowerCase())) {
            return { filtered: true, reason: 'הודעה מכילה תוכן לא הולם' };
        }
    }
    
    // Check English profanity
    for (const word of profanityFilter.english) {
        if (lowerMessage.includes(word.toLowerCase())) {
            return { filtered: true, reason: 'הודעה מכילה תוכן לא הולם' };
        }
    }
    
    return { filtered: false, reason: null };
}

io.on('connection', async (socket) => {
 const sess = socket.request.session;
 const username = sess.username;

 if (!username) {
   socket.disconnect(true);
   return;
 }

 if (usernames[username] && usernames[username] !== socket.id) {
   const oldSocketId = usernames[username];
   if (io.sockets.sockets.get(oldSocketId)) {
       io.to(oldSocketId).emit('forceDisconnect');
       io.sockets.sockets.get(oldSocketId).disconnect(true);
   }
   if (players[oldSocketId]) delete players[oldSocketId];
 }

 usernames[username] = socket.id;

 // Find user with case-insensitive username comparison
 let dbUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });

 if (!dbUser) {
   const initialInventoryForNewUser = {};
   ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => initialInventoryForNewUser[catKey] = []);
   const initialEquippedForNewUser = {};
   ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => initialEquippedForNewUser[catKey] = null);

   dbUser = new User({
       username,
       password: '', // IMPORTANT: Passwords MUST be hashed in a real application
       coins: 0,
       level: 1,
       inventory: initialInventoryForNewUser,
       equipped: initialEquippedForNewUser
   });
   try {
       await dbUser.save();
   } catch (err) {
       socket.disconnect(true); // Or handle error more gracefully
       return;
   }
 }

 // Check if user is banned
 if (dbUser.banned || dbUser.isBanned) {
   socket.emit('banned', { message: 'Your account has been banned.' });
   socket.disconnect(true);
   return;
 }

 players[socket.id] = initializePlayerData(dbUser);
 players[socket.id].id = socket.id; // Set the correct socket ID
 players[socket.id].socketId = socket.id; // Store socket ID for verification

 // Initialize player in default room (beach)
 playerRooms[socket.id] = 'beach';
 rooms.beach.currentPlayers++;

 // Generate homeId for new users if they don't have one
 if (!dbUser.homeId) {
   dbUser.homeId = `home_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   await dbUser.save();
 }

 // Create home room for this user if it doesn't exist
 if (!homeRooms[dbUser.homeId]) {
   homeRooms[dbUser.homeId] = {
     id: dbUser.homeId,
     name: `${players[socket.id].username}'s Home`,
     background: 'rooms/house.png',
     maxCapacity: 1,
     currentPlayers: 0,
     owner: players[socket.id].username
   };
 }

 socket.emit('updateInventory', players[socket.id].inventory);
 socket.emit('updateEquipped', players[socket.id].equipped);
 socket.emit('updateCoins', players[socket.id].coins);
 socket.emit('updateDiamonds', players[socket.id].diamonds);
 socket.emit('userInfo', { 
   username: players[socket.id].username,
   isAdmin: players[socket.id].isAdmin,
   socketId: socket.id,
   homeId: dbUser.homeId,
   diamonds: players[socket.id].diamonds
 });
 emitPlayersWithRooms();
 
 // Broadcast updated room occupancy
 io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });

 socket.on('requestUserData', async () => {
   // Find user with case-insensitive username comparison
   const userFromDb = await User.findOne({ username: { $regex: new RegExp(`^${players[socket.id]?.username || username}$`, 'i') } }); // use username from session as fallback
   if (userFromDb && players[socket.id]) { // Ensure player still connected
       const freshPlayerData = initializePlayerData(userFromDb);
       players[socket.id].coins = freshPlayerData.coins;
       players[socket.id].inventory = freshPlayerData.inventory;
       players[socket.id].equipped = freshPlayerData.equipped;
       players[socket.id].diamonds = freshPlayerData.diamonds;

     socket.emit('updateInventory', freshPlayerData.inventory);
     socket.emit('updateEquipped', freshPlayerData.equipped);
     socket.emit('updateCoins', freshPlayerData.coins);
     socket.emit('updateDiamonds', freshPlayerData.diamonds);
       } else if (!userFromDb) {
   }
 });

 socket.on('afkStatus', (data) => {
   const currentPlayer = players[socket.id];
   if (!currentPlayer || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
       console.log('SERVER: Unauthorized AFK status update from socket:', socket.id);
       socket.disconnect(true);
       return;
   }
   
   if (players[socket.id]) {
     players[socket.id].isAFK = data.isAFK;
     // AFK status will be sent via updatePlayers, no need for separate event
   }
 });

 socket.on('move', (pos) => {
   // Security: Verify the socket.id matches the actual user
   const currentPlayer = players[socket.id];
   if (!currentPlayer || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
       console.log('SERVER: Unauthorized move attempt from socket:', socket.id);
       // Disconnect immediately for unauthorized access
       socket.disconnect(true);
       return;
   }
   
   if (players[socket.id]) {
     const p = players[socket.id];
     
     // Security: Validate position data
     if (typeof pos.x !== 'number' || typeof pos.y !== 'number' || 
       isNaN(pos.x) || isNaN(pos.y) ||
       pos.x < -1000 || pos.y < -1000 || pos.x > 3000 || pos.y > 2000) {
     console.log('SERVER: Invalid position data from socket:', socket.id, pos);
     p.spamCounter = (p.spamCounter || 0) + 1;
     if (p.spamCounter >= 10) {
       console.log('SERVER: Disconnecting spammer for invalid data:', socket.id);
       socket.disconnect(true);
       return;
     }
     return;
   }
     
     // Security: Validate movement speed and distance
     const dx = pos.x - p.x;
     const dy = pos.y - p.y;
     const distance = Math.sqrt(dx * dx + dy * dy);
     const maxSpeed = 1000; // Maximum allowed movement per update
     
     if (distance > maxSpeed) {
       // Just ignore the move, don't disconnect
       return;
     }
     
     // Additional security: Check for suspicious movement patterns (disabled for normal movement)
     // if (distance > 200 && timeSinceLastMove < 50) {
     //   console.log('SERVER: Suspicious movement pattern from socket:', socket.id, 'distance:', distance, 'time:', timeSinceLastMove);
     //   return;
     // }
     
     // Security: Prevent teleporting - check if movement is reasonable
     if (distance > 0 && distance < 1) {
       // Very small movements are fine, no need to log
     }
     
     // Security: Rate limiting - prevent too many move events
     const now = Date.now();
     if (!p.lastMoveTime) p.lastMoveTime = 0;
     const timeSinceLastMove = now - p.lastMoveTime;
     const minMoveInterval = 16; // Minimum 16ms between moves (60 FPS)
     
     if (timeSinceLastMove < minMoveInterval) {
       // Just ignore the move, don't disconnect
       return;
     }
     p.lastMoveTime = now;
     
     // Security: Validate direction
     const validDirections = ['front', 'back', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right', 'up', 'down'];
     const direction = validDirections.includes(pos.direction) ? pos.direction : 'front';
     
     // Security: Final validation before updating target (disabled for normal movement)
     // if (Math.abs(pos.x - p.x) > maxSpeed || Math.abs(pos.y - p.y) > maxSpeed) {
     //   console.log('SERVER: Position change too large from socket:', socket.id, 'dx:', Math.abs(pos.x - p.x), 'dy:', Math.abs(pos.y - p.y));
     //   return;
     // }
     
     // Reset AFK status when player moves
     if (p.isAFK) {
       p.isAFK = false;
     }
     
     // Update target position for smooth movement (keep current position)
     p.targetX = pos.x;
     p.targetY = pos.y;
     p.direction = direction;
     
     // Emit updates at regular intervals for smooth animation
     const currentTime = Date.now();
     if (!p.lastEmitTime) p.lastEmitTime = 0;
     if (currentTime - p.lastEmitTime > 100) { // Emit every 100ms
       p.lastEmitTime = currentTime;
       emitPlayersWithRooms();
     }
   }
 });

 socket.on('chat', (text) => {
   if (players[socket.id]) {
     // Security: Rate limiting for chat
     const now = Date.now();
     if (!players[socket.id].lastChatTime) players[socket.id].lastChatTime = 0;
     if (now - players[socket.id].lastChatTime < 1000) { // Max 1 chat per second
       // Just ignore the chat, don't disconnect
       return;
     }
     players[socket.id].lastChatTime = now;
     
     // Security: Sanitize chat message
     if (typeof text !== 'string' || text.trim().length === 0 || text.length > 50) {
       // Just ignore invalid messages, don't disconnect
       return;
     }
     
     // Apply chat filtering
     const filterResult = filterChatMessage(text.trim());
     if (filterResult.filtered) {
       // Send warning to player about filtered message
       socket.emit('chatFiltered', { reason: filterResult.reason });
       return;
     }
     
     // Reset AFK status when player chats
     if (players[socket.id].isAFK) {
       players[socket.id].isAFK = false;
     }
     
     players[socket.id].message = text.substring(0, 50).trim(); // Limit message length
     players[socket.id].messageTime = Date.now();
     
     // Clear old messages after 10 seconds to prevent memory issues and ensure consistent timing
     // This helps maintain consistent 8-second bubble display across all clients and prevents timing issues
     setTimeout(() => {
       if (players[socket.id] && players[socket.id].messageTime === Date.now() - 10000) {
         players[socket.id].message = null;
         players[socket.id].messageTime = null;
         emitPlayersWithRooms();
       }
     }, 10000);
     
     emitPlayersWithRooms();
   }
 });

 socket.on('adminAddCoins', async ({ username: targetUsername, amount }) => {
   // Verify the socket.id matches the actual user and is valid
   const currentPlayer = players[socket.id];
   if (!currentPlayer || !currentPlayer.isAdmin || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
       console.log('SERVER: Unauthorized admin access attempt from socket:', socket.id);
       socket.emit('adminActionFeedback', { success: false, message: 'Admin access required' });
       return;
   }

   if (!targetUsername || typeof targetUsername !== 'string' || targetUsername.trim().length === 0) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid username' });
       return;
   }
   
   const parsedAmount = parseInt(amount);
   if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid amount (must be 1-1,000,000)' });
       return;
   }

   const userToUpdate = await User.findOne({ username: { $regex: new RegExp(`^${targetUsername.trim()}$`, 'i') } });
   if (userToUpdate) {
     userToUpdate.coins = (Number(userToUpdate.coins) || 0) + parsedAmount;
     try {
       await userToUpdate.save();
       const targetSocketId = usernames[targetUsername];
       if (targetSocketId && players[targetSocketId]) {
         players[targetSocketId].coins = userToUpdate.coins;
         io.to(targetSocketId).emit('updateCoins', userToUpdate.coins);
       }
       emitPlayersWithRooms();
       socket.emit('adminActionFeedback', { success: true, message: `Added ${parsedAmount} coins to ${targetUsername}. Total: ${userToUpdate.coins}` });
     } catch (err) {
       socket.emit('adminActionFeedback', { success: false, message: `DB error updating coins for ${targetUsername}.` });
     }
   } else {
       socket.emit('adminActionFeedback', { success: false, message: `User ${targetUsername} not found.` });
   }
 });

 socket.on('adminAddDiamonds', async ({ username: targetUsername, amount }) => {
   // Verify the socket.id matches the actual user and is valid
   const currentPlayer = players[socket.id];
   if (!currentPlayer || !currentPlayer.isAdmin || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
       console.log('SERVER: Unauthorized admin access attempt from socket:', socket.id);
       socket.emit('adminActionFeedback', { success: false, message: 'Admin access required' });
       return;
   }
   
   if (!targetUsername || typeof targetUsername !== 'string' || targetUsername.trim().length === 0) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid username' });
       return;
   }
   
   const parsedAmount = parseInt(amount);
   if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid amount (must be 1-100)' });
       return;
   }
   
   const userToUpdate = await User.findOne({ username: { $regex: new RegExp(`^${targetUsername.trim()}$`, 'i') } });
   if (userToUpdate) {
     userToUpdate.diamonds = (Number(userToUpdate.diamonds) || 0) + parsedAmount;
     try {
       await userToUpdate.save();
       const targetSocketId = usernames[targetUsername];
       if (targetSocketId && players[targetSocketId]) {
         players[targetSocketId].diamonds = userToUpdate.diamonds;
         io.to(targetSocketId).emit('updateDiamonds', userToUpdate.diamonds);
       }
       emitPlayersWithRooms();
       socket.emit('adminActionFeedback', { success: true, message: `Added ${parsedAmount} diamonds to ${targetUsername}. Total: ${userToUpdate.diamonds}` });
     } catch (err) {
       socket.emit('adminActionFeedback', { success: false, message: `DB error updating diamonds for ${targetUsername}.` });
     }
   } else {
       socket.emit('adminActionFeedback', { success: false, message: `User ${targetUsername} not found.` });
   }
 });

 socket.on('adminGiveItem', async ({ username: targetUsername, category, itemId }) => {
   // Verify the socket.id matches the actual user and is valid
   const currentPlayer = players[socket.id];
   if (!currentPlayer || !currentPlayer.isAdmin || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
       console.log('SERVER: Unauthorized admin access attempt from socket:', socket.id);
       socket.emit('adminActionFeedback', { success: false, message: 'Admin access required' });
       return;
   }
   
   if (!targetUsername || typeof targetUsername !== 'string' || targetUsername.trim().length === 0) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid username' });
       return;
   }
   
   if (!category || typeof category !== 'string' || !ITEM_CATEGORIES_SERVER_KEYS.includes(category)) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid category' });
       return;
   }
   
   const numericItemId = parseInt(itemId);
   if (isNaN(numericItemId) || numericItemId <= 0 || numericItemId > 9999) {
       socket.emit('adminActionFeedback', { success: false, message: 'Invalid item ID (must be 1-9999)' });
       return;
   }

   const userToUpdate = await User.findOne({ username: targetUsername });
   if (userToUpdate) {
     if (!userToUpdate.inventory) userToUpdate.inventory = {}; // Initialize if missing
     if (!Array.isArray(userToUpdate.inventory[category])) {
       userToUpdate.inventory[category] = []; // Ensure category array exists
     }

     if (!userToUpdate.inventory[category].includes(numericItemId)) {
       userToUpdate.inventory[category].push(numericItemId);
       // CRITICAL: If inventory is Schema.Types.Mixed in your User model
       userToUpdate.markModified('inventory');
     } else {
       socket.emit('adminActionFeedback', { success: true, message: `Item ${category}:${numericItemId} already in ${targetUsername}'s inventory.` });
       // Even if not added, ensure client player objects are synced if they somehow diverged
       const targetSocketId = usernames[targetUsername];
       if (targetSocketId && players[targetSocketId]) {
            // Sync inventory if it was somehow out of date in 'players' object
           if (JSON.stringify(players[targetSocketId].inventory) !== JSON.stringify(userToUpdate.inventory)) {
               players[targetSocketId].inventory = JSON.parse(JSON.stringify(userToUpdate.inventory)); // Deep copy
               io.to(targetSocketId).emit('updateInventory', players[targetSocketId].inventory);
               emitPlayersWithRooms();
           }
       }
       return; // No change to save
     }

     try {
       await userToUpdate.save();
       const targetSocketId = usernames[targetUsername];
       if (targetSocketId && players[targetSocketId]) {
         players[targetSocketId].inventory = JSON.parse(JSON.stringify(userToUpdate.inventory)); // Deep copy
         io.to(targetSocketId).emit('updateInventory', players[targetSocketId].inventory);
       }
       emitPlayersWithRooms();
       socket.emit('adminActionFeedback', { success: true, message: `Item ${category}:${numericItemId} given to ${targetUsername}.` });
     } catch (err) {
       socket.emit('adminActionFeedback', { success: false, message: `DB error giving item to ${targetUsername}.` });
     }
   } else {
     socket.emit('adminActionFeedback', { success: false, message: `User ${targetUsername} not found.` });
   }
 });

 socket.on('equipItem', async ({ category, itemId }) => {
   const playerSession = players[socket.id];
   if (!playerSession) {
       return;
   }

   // Security: Sanitize and validate input
   if (!category || typeof category !== 'string' || !ITEM_CATEGORIES_SERVER_KEYS.includes(category)) {
       socket.emit('actionFeedback', { success: false, message: 'Invalid category' });
       return;
   }
   
   const numericItemId = itemId === null ? null : parseInt(itemId);
   if (itemId !== null && (isNaN(numericItemId) || numericItemId <= 0 || numericItemId > 9999)) {
       socket.emit('actionFeedback', { success: false, message: 'Invalid item ID' });
       return;
   }

   // Security: Check if player owns the item before equipping (unless un-equipping)
   if (numericItemId !== null) {
       if (!playerSession.inventory[category] || !playerSession.inventory[category].includes(numericItemId)) {
           socket.emit('actionFeedback', { success: false, message: "Cannot equip item not in inventory." });
           return;
       }
   }

   playerSession.equipped[category] = numericItemId; // Update live player object first for responsiveness

   const userToUpdate = await User.findOne({ username: playerSession.username });
   if (userToUpdate) {
     if (!userToUpdate.equipped) userToUpdate.equipped = {}; // Initialize if missing
     ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => { // Ensure all categories exist
         if (!userToUpdate.equipped.hasOwnProperty(catKey)) userToUpdate.equipped[catKey] = null;
     });
     userToUpdate.equipped[category] = numericItemId;
     // CRITICAL: If equipped is Schema.Types.Mixed in your User model
     userToUpdate.markModified('equipped');
     try {
       await userToUpdate.save();
       socket.emit('updateEquipped', userToUpdate.equipped); // Send the full, saved equipped object
       // Broadcast to all players for real-time synchronization
       emitPlayersWithRooms();
     } catch (err) {
     }
   }
 });

 socket.on('adminBroadcast', (msg) => {
   console.log('SERVER: adminBroadcast received:', msg);
   // Verify the socket.id matches the actual user and is valid
   const currentPlayer = players[socket.id];
   console.log('SERVER: Player data:', currentPlayer);
   console.log('SERVER: Is admin?', currentPlayer?.isAdmin);
   if (!currentPlayer || !currentPlayer.isAdmin || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
       console.log('SERVER: Unauthorized admin access attempt from socket:', socket.id);
       return;
   }
   // Security: Sanitize message
   if (!msg || typeof msg !== 'string' || msg.trim().length === 0 || msg.length > 500) {
       return;
   }
   console.log('SERVER: Broadcasting admin message:', { message: msg.trim(), username: players[socket.id]?.username, isAdmin: true });
   io.emit('adminMessage', { message: msg.trim(), username: players[socket.id]?.username, isAdmin: true });
 });

 socket.on('emojiUsed', ({ emoji, username }) => {
   console.log("✅ Server received emoji:", emoji, "from", username);
   if (typeof emoji !== 'string' || !['happy','sad','angry','laugh','heart','star','diamond','flower','very-happy','devil','crying','😀','😭','😡','😂','❤️'].includes(emoji) || !username) {
     console.log("❌ Invalid emoji data received:", { emoji, username });
     return;
   }
   
   // Get the sender's room
   const senderRoom = playerRooms[socket.id];
   if (!senderRoom) {
     console.log("❌ Sender not in any room");
     return;
   }
   
   console.log("📢 Broadcasting showEmoji to room:", senderRoom, "with:", { emoji, username });
   
   // Broadcast emoji only to players in the same room
   const playersInSameRoom = Object.keys(players).filter(playerId => 
     playerRooms[playerId] === senderRoom
   );
   
   playersInSameRoom.forEach(playerId => {
     io.to(playerId).emit('showEmoji', { emoji, username });
   });
 });

 // Admin disconnect player
 socket.on('adminDisconnect', async ({ username: targetUsername }) => {
   const currentPlayer = players[socket.id];
   if (!currentPlayer || !currentPlayer.isAdmin || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
     console.log('SERVER: Unauthorized admin disconnect attempt from socket:', socket.id);
     socket.emit('adminActionFeedback', { success: false, message: 'Admin access required' });
     return;
   }

   if (!targetUsername) {
     socket.emit('adminActionFeedback', { success: false, message: 'Invalid username' });
     return;
   }

   const targetSocketId = usernames[targetUsername];
   if (!targetSocketId) {
     socket.emit('adminActionFeedback', { success: false, message: `User ${targetUsername} not found or not online` });
     return;
   }

   try {
     // Disconnect the target player
     io.to(targetSocketId).emit('adminDisconnected', { message: 'You have been disconnected by an admin' });
     io.sockets.sockets.get(targetSocketId).disconnect();
     
     socket.emit('adminActionFeedback', { success: true, message: `User ${targetUsername} has been disconnected` });
   } catch (error) {
     console.error('Error disconnecting user:', error);
     socket.emit('adminActionFeedback', { success: false, message: `Failed to disconnect ${targetUsername}` });
   }
 });

 // Admin ban player
 socket.on('adminBan', async ({ username: targetUsername, reason }) => {
   const currentPlayer = players[socket.id];
   if (!currentPlayer || !currentPlayer.isAdmin || currentPlayer.socketId !== socket.id || !usernames[currentPlayer.username] || usernames[currentPlayer.username] !== socket.id) {
     console.log('SERVER: Unauthorized admin ban attempt from socket:', socket.id);
     socket.emit('adminActionFeedback', { success: false, message: 'Admin access required' });
     return;
   }

   if (!targetUsername) {
     socket.emit('adminActionFeedback', { success: false, message: 'Invalid username' });
     return;
   }

   try {
     const userToBan = await User.findOne({ username: targetUsername });
     if (!userToBan) {
       socket.emit('adminActionFeedback', { success: false, message: `User ${targetUsername} not found` });
       return;
     }

     userToBan.isBanned = true;
     userToBan.banned = true;
     userToBan.banReason = reason || 'No reason provided';
     userToBan.banDate = new Date();
     await userToBan.save();

     // Disconnect the user if they're online
     const targetSocketId = usernames[targetUsername];
     if (targetSocketId) {
       io.to(targetSocketId).emit('adminBanned', { 
         message: `You have been banned by an admin. Reason: ${reason || 'No reason provided'}` 
       });
       io.sockets.sockets.get(targetSocketId).disconnect();
     }

     socket.emit('adminActionFeedback', { success: true, message: `User ${targetUsername} has been banned` });
   } catch (error) {
     console.error('Error banning user:', error);
     socket.emit('adminActionFeedback', { success: false, message: `Failed to ban ${targetUsername}` });
   }
 });

 socket.on('disconnect', () => {
   const p = players[socket.id];
   if (p && usernames[p.username] === socket.id) { // Only delete mapping if this was the active socket
       delete usernames[p.username];
   }
   delete players[socket.id];
   
   // Remove player from room tracking
   if (playerRooms[socket.id]) {
       const roomId = playerRooms[socket.id];
       if (rooms[roomId]) {
           rooms[roomId].currentPlayers = Math.max(0, rooms[roomId].currentPlayers - 1);
       } else if (homeRooms[roomId]) {
           homeRooms[roomId].currentPlayers = Math.max(0, homeRooms[roomId].currentPlayers - 1);
       }
   }
   delete playerRooms[socket.id];
   // Broadcast updated room occupancy
   io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });
   
   emitPlayersWithRooms();
   // Remove from in-trade list if needed
   playersInTrade.delete(socket.id);
   io.emit('playersInTrade', Array.from(playersInTrade));
 });

 // --- Trading Events ---
 socket.on('sendTradeRequest', ({ targetId }) => {
     // Prevent sending if sender or target is already in a trade
     if (playersInTrade.has(socket.id)) {
         socket.emit('tradeBusy', { message: 'אתה כבר נמצא בהחלפה!' });
         return;
     }
     if (playersInTrade.has(targetId)) {
         socket.emit('tradeBusy', { message: 'המשתמש עסוק כרגע בהחלפה.' });
         return;
     }
     const sender = players[socket.id];
     const target = players[targetId];
     if (!sender || !target) return;
     // Prevent duplicate requests from same sender to same target
     if (pendingTradeRequests.some(r => r.senderId === socket.id && r.targetId === targetId)) return;
     pendingTradeRequests.push({ senderId: socket.id, senderName: sender.username, targetId });
     io.to(targetId).emit('tradeRequestReceived', {
         senderId: socket.id,
         senderName: sender.username,
         targetId
     });
 });

 socket.on('declineTradeRequest', ({ senderId }) => {
     // Remove from pending
     const idx = pendingTradeRequests.findIndex(r => r.senderId === senderId && r.targetId === socket.id);
     if (idx !== -1) pendingTradeRequests.splice(idx, 1);
     io.to(senderId).emit('tradeRequestDeclined', { senderId, targetId: socket.id });
 });

 socket.on('cancelTradeRequest', ({ targetId }) => {
     // Remove from pending
     const idx = pendingTradeRequests.findIndex(r => r.senderId === socket.id && r.targetId === targetId);
     if (idx !== -1) pendingTradeRequests.splice(idx, 1);
     io.to(targetId).emit('tradeRequestCanceled', { senderId: socket.id, targetId });
 });

 socket.on('acceptTradeRequest', ({ senderId }) => {
     // Prevent if either is already in a trade
     if (playersInTrade.has(socket.id) || playersInTrade.has(senderId)) {
         socket.emit('tradeBusy', { message: 'אתה או השולח כבר נמצאים בהחלפה.' });
         return;
     }
     // Remove all pending requests targeting this player
     for (let i = pendingTradeRequests.length - 1; i >= 0; i--) {
         if (pendingTradeRequests[i].targetId === socket.id) {
             const req = pendingTradeRequests[i];
             io.to(req.senderId).emit('tradeRequestCanceled', { senderId: req.senderId, targetId: socket.id });
             pendingTradeRequests.splice(i, 1);
         }
     }
     // Remove all outgoing requests from this player
     for (let i = pendingTradeRequests.length - 1; i >= 0; i--) {
         if (pendingTradeRequests[i].senderId === socket.id) {
             const req = pendingTradeRequests[i];
             io.to(req.targetId).emit('tradeRequestCanceled', { senderId: socket.id, targetId: req.targetId });
             pendingTradeRequests.splice(i, 1);
         }
     }
     // Mark both players as in trade
     playersInTrade.add(socket.id);
     playersInTrade.add(senderId);
     io.emit('playersInTrade', Array.from(playersInTrade));
     // Create active trade
     const tradeId = `${socket.id}-${senderId}`;
     activeTrades[tradeId] = {
         player1: socket.id,
         player2: senderId,
         offers: { [socket.id]: [], [senderId]: [] },
         locked: { [socket.id]: false, [senderId]: false },
         confirmed: { [socket.id]: false, [senderId]: false }
     };
     // Start trade between sender and accepter
     io.to(senderId).emit('tradeStarted', {
         yourName: players[senderId]?.username || 'You',
         theirName: players[socket.id]?.username || 'Other',
         yourOffer: [],
         theirOffer: [],
         yourLocked: false,
         theirLocked: false,
         yourConfirmed: false,
         theirConfirmed: false,
         theirId: socket.id
     });
     socket.emit('tradeStarted', {
         yourName: players[socket.id]?.username || 'You',
         theirName: players[senderId]?.username || 'Other',
         yourOffer: [],
         theirOffer: [],
         yourLocked: false,
         theirLocked: false,
         yourConfirmed: false,
         theirConfirmed: false,
         theirId: senderId
     });
 });

 socket.on('updateTradeOffer', ({ offer }) => {
     // Find active trade for this player
     const tradeId = Object.keys(activeTrades).find(id => 
         activeTrades[id].player1 === socket.id || activeTrades[id].player2 === socket.id
     );
     if (!tradeId) return;
     
     const trade = activeTrades[tradeId];
     trade.offers[socket.id] = offer;
     
     // Emit to both players
     const otherPlayer = trade.player1 === socket.id ? trade.player2 : trade.player1;
     io.to(otherPlayer).emit('tradeOfferUpdated', { senderId: socket.id, offer });
     socket.emit('tradeOfferUpdated', { senderId: socket.id, offer });
 });

 socket.on('sendTradeChat', ({ text }) => {
     // Find active trade for this player
     const tradeId = Object.keys(activeTrades).find(id => 
         activeTrades[id].player1 === socket.id || activeTrades[id].player2 === socket.id
     );
     if (!tradeId) return;
     
     const trade = activeTrades[tradeId];
     const sender = players[socket.id];
     if (!sender) return;
     
     // Emit to both players in the trade
     const message = { senderId: socket.id, senderName: sender.username, text };
     io.to(trade.player1).emit('tradeChatMessage', message);
     io.to(trade.player2).emit('tradeChatMessage', message);
 });

 socket.on('lockTradeOffer', () => {
     const tradeId = Object.keys(activeTrades).find(id => 
         activeTrades[id].player1 === socket.id || activeTrades[id].player2 === socket.id
     );
     if (!tradeId) return;
     
     const trade = activeTrades[tradeId];
     trade.locked[socket.id] = true;
     
     // Emit to both players
     const otherPlayer = trade.player1 === socket.id ? trade.player2 : trade.player1;
     io.to(otherPlayer).emit('tradeOfferLocked', { senderId: socket.id });
     socket.emit('tradeOfferLocked', { senderId: socket.id });
 });

 socket.on('unlockTradeOffer', () => {
     const tradeId = Object.keys(activeTrades).find(id => 
         activeTrades[id].player1 === socket.id || activeTrades[id].player2 === socket.id
     );
     if (!tradeId) return;
     
     const trade = activeTrades[tradeId];
     trade.locked[socket.id] = false;
     trade.confirmed[socket.id] = false; // Reset confirmation when unlocking
     
     // Emit to both players
     const otherPlayer = trade.player1 === socket.id ? trade.player2 : trade.player1;
     io.to(otherPlayer).emit('tradeOfferUnlocked', { senderId: socket.id });
     socket.emit('tradeOfferUnlocked', { senderId: socket.id });
 });

 socket.on('confirmTrade', () => {
     const tradeId = Object.keys(activeTrades).find(id => 
         activeTrades[id].player1 === socket.id || activeTrades[id].player2 === socket.id
     );
     if (!tradeId) return;
     
     const trade = activeTrades[tradeId];
     trade.confirmed[socket.id] = true;
     
     // Emit to both players
     const otherPlayer = trade.player1 === socket.id ? trade.player2 : trade.player1;
     io.to(otherPlayer).emit('tradeOfferConfirmed', { senderId: socket.id });
     socket.emit('tradeOfferConfirmed', { senderId: socket.id });
     
     // Check if both players confirmed
     if (trade.confirmed[trade.player1] && trade.confirmed[trade.player2]) {
         // Execute the trade - transfer items
         executeTrade(tradeId);
     }
 });

 socket.on('cancelTrade', () => {
     const tradeId = Object.keys(activeTrades).find(id => 
         activeTrades[id].player1 === socket.id || activeTrades[id].player2 === socket.id
     );
     if (!tradeId) return;
     
     const trade = activeTrades[tradeId];
     const otherPlayer = trade.player1 === socket.id ? trade.player2 : trade.player1;
     
     // Notify both players
     io.to(otherPlayer).emit('tradeCanceled', { senderId: socket.id });
     socket.emit('tradeCanceled', { senderId: socket.id });
     
     // Clean up
     delete activeTrades[tradeId];
     // Remove both players from in-trade list
     playersInTrade.delete(trade.player1);
     playersInTrade.delete(trade.player2);
     io.emit('playersInTrade', Array.from(playersInTrade));
 });

 // --- Room Management Events ---
 socket.on('requestRoomOccupancy', () => {
     socket.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });
 });

 socket.on('room_change', ({ room }) => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer) return;

     // Update player's room
     const currentRoomId = playerRooms[socket.id];
     if (currentRoomId !== room) {
         // Remove player from current room
         if (currentRoomId) {
             if (rooms[currentRoomId]) {
                 rooms[currentRoomId].currentPlayers = Math.max(0, rooms[currentRoomId].currentPlayers - 1);
             } else if (homeRooms[currentRoomId]) {
                 homeRooms[currentRoomId].currentPlayers = Math.max(0, homeRooms[currentRoomId].currentPlayers - 1);
             }
         }

         // Add player to new room
         playerRooms[socket.id] = room;
         if (rooms[room]) {
             rooms[room].currentPlayers++;
         } else if (homeRooms[room]) {
             homeRooms[room].currentPlayers++;
         }

         // Immediately emit updated player data to all clients
         emitPlayersWithRooms();
         
         // Broadcast updated room occupancy
         io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });
     }
 });

 socket.on('joinRoom', ({ roomId }) => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer) {
         socket.emit('roomJoinResponse', { success: false, message: 'Player not found' });
         return;
     }

     // Validate room ID
     if (!rooms[roomId]) {
         socket.emit('roomJoinResponse', { success: false, message: 'Invalid room' });
         return;
     }

     const room = rooms[roomId];
     const currentRoomId = playerRooms[socket.id];

     // Check if player is already in this room
     if (currentRoomId === roomId) {
         socket.emit('roomJoinResponse', { success: false, message: 'You are already in this room.' });
         return;
     }

     // Check if room is full
     if (room.currentPlayers >= room.maxCapacity) {
         socket.emit('roomJoinResponse', { success: false, message: 'This room is full.' });
         return;
     }

     // Remove player from current room
     if (currentRoomId && rooms[currentRoomId]) {
         rooms[currentRoomId].currentPlayers = Math.max(0, rooms[currentRoomId].currentPlayers - 1);
     }

     // Add player to new room
     playerRooms[socket.id] = roomId;
     room.currentPlayers++;

     // Broadcast updated room occupancy to all clients
     io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });

     // Immediately emit updated player data to all clients
     emitPlayersWithRooms();

     // Send success response to the joining player
     socket.emit('roomJoinResponse', { 
         success: true, 
         roomId: roomId,
         message: `Successfully joined ${room.name}!`
     });

     console.log(`Player ${currentPlayer.username} joined room ${roomId} (${room.currentPlayers}/${room.maxCapacity})`);
 });

 // Home System Events
 socket.on('enterHome', async () => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer) {
         socket.emit('homeResponse', { success: false, message: 'Player not found' });
         return;
     }

     // Find user in database to get homeId
     const dbUser = await User.findOne({ username: { $regex: new RegExp(`^${currentPlayer.username}$`, 'i') } });
     if (!dbUser || !dbUser.homeId) {
         socket.emit('homeResponse', { success: false, message: 'Home not found' });
         return;
     }

     const homeId = dbUser.homeId;
     const currentRoomId = playerRooms[socket.id];

     // Store previous room for exit functionality
     if (currentRoomId && currentRoomId !== homeId) {
         playerPreviousRooms[socket.id] = currentRoomId;
     }

     // Create home room if it doesn't exist
     if (!homeRooms[homeId]) {
         homeRooms[homeId] = {
             id: homeId,
             name: `${currentPlayer.username}'s Home`,
             background: 'rooms/house.png',
             maxCapacity: 1,
             currentPlayers: 0,
             owner: currentPlayer.username
         };
     }

     // Remove player from current room
     if (currentRoomId) {
         if (rooms[currentRoomId]) {
             rooms[currentRoomId].currentPlayers = Math.max(0, rooms[currentRoomId].currentPlayers - 1);
         } else if (homeRooms[currentRoomId]) {
             homeRooms[currentRoomId].currentPlayers = Math.max(0, homeRooms[currentRoomId].currentPlayers - 1);
         }
     }

     // Add player to home room
     playerRooms[socket.id] = homeId;
     homeRooms[homeId].currentPlayers++;

     // Update player position to center of home
     players[socket.id].x = 600;
     players[socket.id].y = 340;
     players[socket.id].targetX = 600;
     players[socket.id].targetY = 340;

     // Broadcast updated room occupancy
     io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });

     // Immediately emit updated player data to all clients
     emitPlayersWithRooms();

     // Send success response
     socket.emit('homeResponse', { 
         success: true, 
         roomId: homeId,
         message: `Welcome to your home!`,
         background: 'rooms/house.png'
     });

     console.log(`Player ${currentPlayer.username} entered home ${homeId}`);
 });

 socket.on('exitHome', () => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer) {
         socket.emit('homeResponse', { success: false, message: 'Player not found' });
         return;
     }

     const currentRoomId = playerRooms[socket.id];
     const previousRoomId = playerPreviousRooms[socket.id] || 'beach'; // Default to beach if no previous room

     // Check if player is actually in their home
     if (!currentRoomId || !currentRoomId.startsWith('home_')) {
         socket.emit('homeResponse', { success: false, message: 'You are not in your home' });
         return;
     }

     // Remove player from current home room
     if (homeRooms[currentRoomId]) {
         homeRooms[currentRoomId].currentPlayers = Math.max(0, homeRooms[currentRoomId].currentPlayers - 1);
     }

     // Add player to previous room
     playerRooms[socket.id] = previousRoomId;
     if (rooms[previousRoomId]) {
         rooms[previousRoomId].currentPlayers++;
     }

     // Update player position to center of previous room
     players[socket.id].x = 600;
     players[socket.id].y = 340;
     players[socket.id].targetX = 600;
     players[socket.id].targetY = 340;

     // Clear previous room tracking
     delete playerPreviousRooms[socket.id];

     // Broadcast updated room occupancy
     io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });

     // Immediately emit updated player data to all clients
     emitPlayersWithRooms();

     // Send success response
     socket.emit('homeResponse', { 
         success: true, 
         roomId: previousRoomId,
         message: `Returned to ${rooms[previousRoomId] ? rooms[previousRoomId].name : 'Beach'}!`,
         background: rooms[previousRoomId] ? rooms[previousRoomId].background : 'rooms/sea.png'
     });

     console.log(`Player ${currentPlayer.username} exited home to ${previousRoomId}`);
 });

 // Visit other player's home
 socket.on('visitHome', async ({ targetUsername }) => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer) {
         socket.emit('homeResponse', { success: false, message: 'Player not found' });
         return;
     }

     if (!targetUsername || typeof targetUsername !== 'string') {
         socket.emit('homeResponse', { success: false, message: 'Invalid target username' });
         return;
     }

     // Find target user in database to get their homeId
     const targetUser = await User.findOne({ username: { $regex: new RegExp(`^${targetUsername}$`, 'i') } });
     if (!targetUser || !targetUser.homeId) {
         socket.emit('homeResponse', { success: false, message: 'Target user or their home not found' });
         return;
     }

     const targetHomeId = targetUser.homeId;
     const currentRoomId = playerRooms[socket.id];

     // Store previous room for exit functionality
     if (currentRoomId && currentRoomId !== targetHomeId) {
         playerPreviousRooms[socket.id] = currentRoomId;
     }

     // Create target home room if it doesn't exist
     if (!homeRooms[targetHomeId]) {
         homeRooms[targetHomeId] = {
             id: targetHomeId,
             name: `${targetUsername}'s Home`,
             background: 'rooms/house.png',
             maxCapacity: 1,
             currentPlayers: 0,
             owner: targetUsername
         };
     }

     // Remove player from current room
     if (currentRoomId) {
         if (rooms[currentRoomId]) {
             rooms[currentRoomId].currentPlayers = Math.max(0, rooms[currentRoomId].currentPlayers - 1);
         } else if (homeRooms[currentRoomId]) {
             homeRooms[currentRoomId].currentPlayers = Math.max(0, homeRooms[currentRoomId].currentPlayers - 1);
         }
     }

     // Add player to target home room
     playerRooms[socket.id] = targetHomeId;
     homeRooms[targetHomeId].currentPlayers++;

     // Update player position to center of target home
     players[socket.id].x = 600;
     players[socket.id].y = 340;
     players[socket.id].targetX = 600;
     players[socket.id].targetY = 340;

     // Broadcast updated room occupancy
     io.emit('roomOccupancyUpdate', { rooms: Object.values(getAllRooms()) });

     // Immediately emit updated player data to all clients
     emitPlayersWithRooms();

     // Send success response
     socket.emit('homeResponse', { 
         success: true, 
         roomId: targetHomeId,
         message: `Visiting ${targetUsername}'s home!`,
         background: 'rooms/house.png',
         isVisiting: true,
         visitedUsername: targetUsername
     });

     console.log(`Player ${currentPlayer.username} is visiting ${targetUsername}'s home ${targetHomeId}`);
 });
 
 // ==================== Store System ====================
 
 // Store items database (in memory for now, can be moved to database later)
 global.storeItems = [];
 
 // Get store items
 socket.on('getStoreItems', () => {
     socket.emit('storeItems', global.storeItems || []);
 });
 
 // Purchase item
 socket.on('purchaseItem', async ({ itemId, category, price, currency }) => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer) {
         socket.emit('purchaseResult', { success: false, message: 'שחקן לא נמצא' });
         return;
     }
     
     // Find the item in store
     const item = storeItems.find(item => 
         item.id === itemId && 
         item.category === category && 
         item.price === price && 
         item.currency === currency
     );
     
     if (!item) {
         socket.emit('purchaseResult', { success: false, message: 'פריט לא נמצא בחנות' });
         return;
     }
     
     // Check if player has enough currency
     const currentCurrency = currency === 'coins' ? currentPlayer.coins : currentPlayer.diamonds;
     if (currentCurrency < price) {
         const currencyName = currency === 'coins' ? 'מטבעות' : 'יהלומים';
         socket.emit('purchaseResult', { 
             success: false, 
             message: `אין לך מספיק ${currencyName} לרכישה זו` 
         });
         return;
     }
     
           // Allow purchasing items even if player already has them
      // (removed the restriction)
     
     try {
         // Update player's currency
         if (currency === 'coins') {
             currentPlayer.coins -= price;
         } else {
             currentPlayer.diamonds -= price;
         }
         
         // Add item to inventory
         if (!currentPlayer.inventory[category]) {
             currentPlayer.inventory[category] = [];
         }
         currentPlayer.inventory[category].push(itemId);
         
         // Update database
         const userToUpdate = await User.findOne({ 
             username: { $regex: new RegExp(`^${currentPlayer.username}$`, 'i') } 
         });
         
         if (userToUpdate) {
             if (currency === 'coins') {
                 userToUpdate.coins = currentPlayer.coins;
             } else {
                 userToUpdate.diamonds = currentPlayer.diamonds;
             }
             userToUpdate.inventory = currentPlayer.inventory;
             await userToUpdate.save();
         }
         
         // Send success response
         socket.emit('purchaseResult', { 
             success: true, 
             message: `רכישה מוצלחת! ${item.name} נוסף למלאי שלך`,
             newCoins: currentPlayer.coins,
             newDiamonds: currentPlayer.diamonds,
             inventory: currentPlayer.inventory
         });
         
         // Update inventory and currency on client
         socket.emit('updateInventory', currentPlayer.inventory);
         socket.emit('updateCoins', currentPlayer.coins);
         socket.emit('updateDiamonds', currentPlayer.diamonds);
         
         console.log(`Player ${currentPlayer.username} purchased ${item.name} for ${price} ${currency}`);
         
     } catch (error) {
         console.error('Error processing purchase:', error);
         socket.emit('purchaseResult', { 
             success: false, 
             message: 'שגיאה בעיבוד הרכישה' 
         });
     }
 });
 
 // Add store item (admin only)
 socket.on('addStoreItem', async ({ itemId, category, name, price, currency }) => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer || !currentPlayer.isAdmin) {
         socket.emit('storeItemResult', { success: false, message: 'גישה מוגבלת למנהלים בלבד' });
         return;
     }
     
     // Validate input
     if (!itemId || !category || !name || !price || !currency) {
         socket.emit('storeItemResult', { success: false, message: 'כל השדות נדרשים' });
         return;
     }
     
     if (price <= 0) {
         socket.emit('storeItemResult', { success: false, message: 'המחיר חייב להיות חיובי' });
         return;
     }
     
     if (!['coins', 'diamonds'].includes(currency)) {
         socket.emit('storeItemResult', { success: false, message: 'מטבע לא תקין' });
         return;
     }
     
     // Check if item already exists
     const existingItem = storeItems.find(item => 
         item.id === itemId && item.category === category
     );
     
     if (existingItem) {
         socket.emit('storeItemResult', { success: false, message: 'פריט זה כבר קיים בחנות' });
         return;
     }
     
     // Add new item
     const newItem = { id: itemId, category, name, price, currency };
     storeItems.push(newItem);
     
     socket.emit('storeItemResult', { 
         success: true, 
         message: `פריט ${name} נוסף לחנות בהצלחה`,
         item: newItem
     });
     
     // Broadcast to all clients that store items have been updated
     io.emit('storeItemsUpdated', storeItems);
     
     console.log(`Admin ${currentPlayer.username} added store item: ${name}`);
 });
 
 // Remove store item (admin only)
 socket.on('removeStoreItem', async ({ itemId, category }) => {
     const currentPlayer = players[socket.id];
     if (!currentPlayer || !currentPlayer.isAdmin) {
         socket.emit('storeItemResult', { success: false, message: 'גישה מוגבלת למנהלים בלבד' });
         return;
     }
     
     // Find and remove item
     const itemIndex = storeItems.findIndex(item => 
         item.id === itemId && item.category === category
     );
     
     if (itemIndex === -1) {
         socket.emit('storeItemResult', { success: false, message: 'פריט לא נמצא' });
         return;
     }
     
     const removedItem = storeItems.splice(itemIndex, 1)[0];
     
     socket.emit('storeItemResult', { 
         success: true, 
         message: `פריט ${removedItem.name} הוסר מהחנות`,
         removedItem
     });
     
     // Broadcast to all clients that store items have been updated
     io.emit('storeItemsUpdated', storeItems);
     
     console.log(`Admin ${currentPlayer.username} removed store item: ${removedItem.name}`);
 });
});

// Registration and Login routes with bcrypt password hashing
app.post('/register', async (req, res) => {
 const { username, password } = req.body;
 if (!username || !password) return res.status(400).send({ error: 'נא למלא את כל השדות' });
 
 // Password strength validation
 if (password.length < 6) {
   return res.status(400).send({ error: 'הסיסמה חייבת להיות לפחות 6 תווים' });
 }

 // Check if username already exists (case-insensitive)
 const existing = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
 if (existing) return res.status(400).send({ error: 'שם המשתמש כבר תפוס' });

 try {
   // Hash password with bcrypt
   const bcrypt = require('bcrypt');
   const saltRounds = 10;
   const hashedPassword = await bcrypt.hash(password, saltRounds);

 const initialInventoryForNewUser = {};
 ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => initialInventoryForNewUser[catKey] = []);
 const initialEquippedForNewUser = {};
 ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => initialEquippedForNewUser[catKey] = null);

 const newUser = new User({
   username, // Save exactly as entered (preserve case)
     password: hashedPassword,
   coins: 0,
   level: 1,
   inventory: initialInventoryForNewUser,
   equipped: initialEquippedForNewUser
 });
   
   await newUser.save();
   res.send({ success: true });
 } catch (err) {
   res.status(500).send({ error: "שגיאה ברישום המשתמש" });
 }
});

app.post('/login', async (req, res) => {
 const { username, password } = req.body;
 // Find user with case-insensitive username comparison
 const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
 
 if (!user) {
   return res.status(400).send({ error: 'שם משתמש או סיסמה שגויים' });
 }

 try {
   // Compare password with bcrypt
   const bcrypt = require('bcrypt');
   const match = await bcrypt.compare(password, user.password);
   
   if (!match) {
     return res.status(400).send({ error: 'שם משתמש או סיסמה שגויים' });
   }

   // Check if user is banned
   if (user.banned || user.isBanned) {
     return res.status(403).send({ error: 'המשתמש חסום' });
   }

 req.session.username = user.username; // Use the original username from database (preserve case)
 req.session.save(err => { // Ensure session is saved before sending response
   if (err) {
       return res.status(500).send({ error: 'שגיאה בהתחברות' });
   }
   res.send({ success: true });
 });
 } catch (err) {
   res.status(500).send({ error: 'שגיאה בהתחברות' });
 }
});

app.get('/game', (req, res) => {
 if (!req.session.username) return res.redirect('/');
 res.sendFile(path.join(__dirname, 'public/game.html'));
});

app.get('/admin', async (req, res) => {
 // Check if user is authenticated
 if (!req.session.username) {
   return res.redirect('/');
 }
 
 // Check if user is admin
 try {
   const user = await User.findOne({ username: req.session.username });
   if (!user || !user.isAdmin) {
     return res.status(403).send(`
       <html>
         <head><title>Access Denied</title></head>
         <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
           <h1 style="color: #e74c3c;">Access Denied</h1>
           <p>You need admin privileges to access this page.</p>
           <a href="/game" style="color: #3498db; text-decoration: none;">Return to Game</a>
         </body>
       </html>
     `);
   }
   
   res.sendFile(path.join(__dirname, 'public/admin.html'));
 } catch (error) {
   console.error('Error checking admin status:', error);
   res.status(500).send('Internal server error');
 }
});



// A simple route to check authenticated user (optional)
app.get('/me', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// API route to get current user info
app.get('/api/user', async (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            username: user.username,
            coins: user.coins || 0,
            diamonds: user.diamonds || 0,
            level: user.level || 1,
            isAdmin: user.isAdmin || false
        });
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API route to award coins for arcade games
app.post('/api/arcade/award-coins', async (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { gameType, amount } = req.body;
        
        if (!gameType || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid game type or amount' });
        }
        
        // Validate amount (prevent abuse)
        if (amount > 100) {
            return res.status(400).json({ error: 'Amount too high' });
        }
        
        const user = await User.findOne({ username: req.session.username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update user's coins
        const newCoins = (user.coins || 0) + amount;
        user.coins = newCoins;
        
        // Check if user should level up (every 100 coins = 1 level)
        const newLevel = Math.floor(newCoins / 100) + 1;
        if (newLevel > user.level) {
            user.level = newLevel;
        }
        
        await user.save();
        
        res.json({
            success: true,
            newCoins: newCoins,
            newLevel: user.level,
            coinsAwarded: amount
        });
        
    } catch (error) {
        console.error('Error awarding coins:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API route to get connected users for arcade
app.get('/api/arcade/connected-users', async (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // Get all connected users from socket.io
        const connectedUsers = [];
        
        // Add all connected players
        for (const [socketId, player] of Object.entries(players)) {
            if (player && player.username) {
                connectedUsers.push({
                    username: player.username,
                    socketId: socketId
                });
            }
        }
        
        res.json(connectedUsers);
        
    } catch (error) {
        console.error('Error getting connected users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// API Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, skinColor, shirt, pants } = req.body;

    console.log('Registration attempt:', { username, email, skinColor, shirt, pants });

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'כל השדות נדרשים' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        message: 'שם משתמש חייב להיות לפחות 3 תווים' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'סיסמה חייב להיות לפחות 6 תווים' 
      });
    }

    // Check if username already exists (case-insensitive)
    const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'שם משתמש כבר קיים במערכת' 
      });
    }

    // Check if email already exists (case-insensitive)
    const existingEmail = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (existingEmail) {
      return res.status(400).json({ 
        message: 'אימייל כבר קיים במערכת' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Initialize inventory and equipped items
    const initialInventory = {};
    ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => {
      initialInventory[catKey] = [];
    });

    const initialEquipped = {};
    ITEM_CATEGORIES_SERVER_KEYS.forEach(catKey => {
      initialEquipped[catKey] = null;
    });

    // Set initial equipped items based on registration choices
    if (skinColor !== null && skinColor !== undefined) {
      initialEquipped.hd = skinColor;
    }
    if (shirt !== null && shirt !== undefined) {
      initialEquipped.st = shirt;
      initialInventory.st = [shirt]; // Add shirt to inventory
    }
    if (pants !== null && pants !== undefined) {
      initialEquipped.ps = pants;
      initialInventory.ps = [pants]; // Add pants to inventory
    }

    // Create new user in MongoDB
    const newUser = new User({
      username: username, // Save exactly as entered (preserve case)
      email: email.toLowerCase(), // Keep email lowercase for consistency
      password: hashedPassword,
      coins: 150,
      inventory: initialInventory,
      equipped: initialEquipped,
      isAdmin: false,
      banned: false,
      createdAt: new Date()
    });

    await newUser.save();

    console.log('User registered successfully in MongoDB:', username);

    // Return success (without password)
    const userResponse = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      coins: newUser.coins,
      inventory: newUser.inventory,
      equipped: newUser.equipped,
      createdAt: newUser.createdAt
    };

    res.status(201).json({
      message: 'ההרשמה בוצעה בהצלחה!',
      user: userResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'שגיאה בשרת, אנא נסה שוב' 
    });
  }
});

// Get items metadata
app.get('/api/items', async (req, res) => {
  try {
    const itemsMetadata = await getAllItemsMetadata();
    res.json(itemsMetadata);
  } catch (error) {
    console.error('Error loading items metadata:', error);
    res.status(500).json({ message: 'שגיאה בטעינת פריטים' });
  }
});

// API endpoint to get specific item metadata
app.get('/api/items/:category/:itemId', (req, res) => {
  try {
    const { category, itemId } = req.params;
    const itemMetadata = getItemMetadata(category, parseInt(itemId));
    if (itemMetadata) {
      res.json(itemMetadata);
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load item metadata' });
  }
});

// Admin endpoint for item offsets
app.get('/admin/item-offsets', async (req, res) => {
  // Check if user is authenticated
  if (!req.session.username) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if user is admin
  try {
    const user = await User.findOne({ username: req.session.username });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const offsets = {
      hd: {
        2: { front: { x: 0, y: 0, width: 1, height: 1 } },
        3: { front: { x: 0, y: 0, width: 1, height: 1 } },
        4: { front: { x: 0, y: 0, width: 1, height: 1 } },
        5: { front: { x: 0, y: 0, width: 1, height: 1 } },
        7: { front: { x: 0, y: 0, width: 1, height: 1 } }
      },
      st: {
        3: { front: { x: 0, y: 0, width: 1, height: 1 } },
        4: { front: { x: 0, y: 0, width: 1, height: 1 } },
        5: { front: { x: 0, y: 0, width: 1, height: 1 } },
        6: { front: { x: 0, y: 0, width: 1, height: 1 } },
        7: { front: { x: 0, y: 0, width: 1, height: 1 } }
      },
      ps: {
        1: { front: { x: 0, y: 0, width: 1, height: 1 } },
        2: { front: { x: 0, y: 0, width: 1, height: 1 } },
        4: { front: { x: 0, y: 0, width: 1, height: 1 } },
        5: { front: { x: 0, y: 0, width: 1, height: 1 } },
        6: { front: { x: 0, y: 0, width: 1, height: 1 } },
        7: { front: { x: 0, y: 0, width: 1, height: 1 } },
        8: { front: { x: 0, y: 0, width: 1, height: 1 } }
      }
    };
    res.json({ offsets });
  } catch (error) {
    console.error('Error in admin item-offsets:', error);
    res.status(500).json({ message: 'שגיאה בטעינת offsets' });
  }
});

// Public route for item offsets (for game client)
app.get('/api/item-offsets', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const offsetsPath = path.join(__dirname, 'config', 'itemOffsets.json');
        
        console.log('Loading item offsets from:', offsetsPath);
        
        if (fs.existsSync(offsetsPath)) {
            const data = fs.readFileSync(offsetsPath, 'utf8');
            console.log('File exists, size:', data.length);
            const offsets = JSON.parse(data);
            console.log('Parsed offsets successfully');
            res.json({ success: true, offsets });
        } else {
            console.log('File does not exist, creating default structure');
            // Create default structure
            const defaultOffsets = {
                ht: {}, ps: {}, st: {}, gs: {}, nk: {}, sz: {}, sk: {}, hd: {}, hr: {}
            };
            fs.writeFileSync(offsetsPath, JSON.stringify(defaultOffsets, null, 2));
            res.json({ success: true, offsets: defaultOffsets });
        }
    } catch (error) {
        console.error('Error loading item offsets:', error);
        res.status(500).json({ error: 'Failed to load item offsets' });
    }
});

// Serve static files
app.get('/', (req, res) => {
  // If user is already logged in, redirect to game
  if (req.session.username) return res.redirect('/game');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  // If user is already logged in, redirect to game
  if (req.session.username) return res.redirect('/game');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
  // If user is already logged in, redirect to game
  if (req.session.username) return res.redirect('/game');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => {
  // If user is already logged in, redirect to game
  if (req.session.username) return res.redirect('/game');
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/game.html', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// New pages routes
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/accessibility', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'accessibility.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

app.get('/store', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

app.get('/arcade', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'arcade.html'));
});

app.get('/games/tictactoe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', 'tictactoe.html'));
});

app.get('/games/connectfour', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', 'connectfour.html'));
});

app.get('/games/memory', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', 'memory.html'));
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: emailConfig.service,
  auth: emailConfig.auth,
  tls: { rejectUnauthorized: false }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working!' });
});

// Contact form email endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'כל השדות הנדרשים חייבים להיות מלאים' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'כתובת האימייל אינה תקינה' 
      });
    }
    
    // Check honeypot field (spam protection)
    if (website) {
      console.log('Spam detected from contact form');
      return res.status(200).json({ success: true }); // Pretend success to avoid spam feedback
    }
    
    // Rate limiting check (simple in-memory)
    const clientIP = req.ip;
    const now = Date.now();
    if (!contactFormRateLimit[clientIP]) {
      contactFormRateLimit[clientIP] = [];
    }
    
    // Remove old entries (older than rate limit window)
    contactFormRateLimit[clientIP] = contactFormRateLimit[clientIP].filter(
      timestamp => now - timestamp < emailConfig.rateLimitWindow
    );
    
    // Check if too many requests
    if (contactFormRateLimit[clientIP].length >= emailConfig.maxRequestsPerHour) {
      return res.status(429).json({ 
        success: false, 
        message: 'יותר מדי בקשות. אנא נסה שוב בעוד שעה' 
      });
    }
    
    // Add current request
    contactFormRateLimit[clientIP].push(now);
    
    // Validate message length
    if (message.length < emailConfig.minMessageLength) {
      return res.status(400).json({ 
        success: false, 
        message: `ההודעה חייבת להכיל לפחות ${emailConfig.minMessageLength} תווים` 
      });
    }
    
    if (message.length > emailConfig.maxMessageLength) {
      return res.status(400).json({ 
        success: false, 
        message: `ההודעה חייבת להכיל פחות מ-${emailConfig.maxMessageLength} תווים` 
      });
    }
    
    // Prepare email content
    const mailOptions = {
      from: emailConfig.from,
      to: emailConfig.to,
      subject: `הודעה חדשה מ-Jumpi: ${subject || 'הודעה חדשה'}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">הודעה חדשה מ-Jumpi</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>שם:</strong> ${name}</p>
            <p><strong>אימייל:</strong> ${email}</p>
            <p><strong>נושא:</strong> ${subject || 'לא צוין'}</p>
            <p><strong>הודעה:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 5px; border-right: 4px solid #667eea;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            הודעה זו נשלחה מטופס צור קשר באתר Jumpi
          </p>
        </div>
      `,
      replyTo: email
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log(`Contact form email sent from ${email} to jumpiiworld@gmail.com`);
    
    res.json({ 
      success: true, 
      message: 'ההודעה נשלחה בהצלחה!' 
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בשליחת ההודעה. אנא נסה שוב מאוחר יותר' 
    });
  }
});

// Rate limiting for contact form
const contactFormRateLimit = {};

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
 console.log(`🚀 Server running on PORT ${PORT}`);
 console.log(`💰 PAYPAL PRODUCTION MODE - LIVE PAYMENTS ENABLED`);
 console.log(`🔒 All payments will be processed as real transactions`);
 console.log(`📊 Transaction logging enabled with environment tracking`);
});

function executeTrade(tradeId) {
    const trade = activeTrades[tradeId];
    if (!trade) return;
    
    const player1 = players[trade.player1];
    const player2 = players[trade.player2];
    if (!player1 || !player2) return;
    
    // Transfer items from player1's offer to player2's inventory
    trade.offers[trade.player1].forEach(item => {
        if (item) {
            // Remove from player1's inventory
            if (player1.inventory[item.cat]) {
                const idx = player1.inventory[item.cat].indexOf(item.id);
                if (idx !== -1) player1.inventory[item.cat].splice(idx, 1);
            }
            // Add to player2's inventory
            if (!player2.inventory[item.cat]) player2.inventory[item.cat] = [];
            player2.inventory[item.cat].push(item.id);
        }
    });
    
    // Transfer items from player2's offer to player1's inventory
    trade.offers[trade.player2].forEach(item => {
        if (item) {
            // Remove from player2's inventory
            if (player2.inventory[item.cat]) {
                const idx = player2.inventory[item.cat].indexOf(item.id);
                if (idx !== -1) player2.inventory[item.cat].splice(idx, 1);
            }
            // Add to player1's inventory
            if (!player1.inventory[item.cat]) player1.inventory[item.cat] = [];
            player1.inventory[item.cat].push(item.id);
        }
    });
    
    // Check if players need to unequip items
    function checkAndUnequipItems(player, tradedItems) {
        if (!player.equipped) return;
        
        tradedItems.forEach(item => {
            if (!item) return;
            
            // Check if player has this item equipped
            if (player.equipped[item.cat] === item.id) {
                // Count how many of this item they have in inventory
                const itemCount = (player.inventory[item.cat] || []).filter(id => id === item.id).length;
                
                // If they don't have any duplicates, unequip
                if (itemCount === 0) {
                    player.equipped[item.cat] = null;
                }
            }
        });
    }
    
    // Check both players
    checkAndUnequipItems(player1, trade.offers[trade.player1]);
    checkAndUnequipItems(player2, trade.offers[trade.player2]);

    // --- Persist to MongoDB ---
    const User = require('./models/User');
    Promise.all([
        User.updateOne({ username: player1.username }, { $set: { inventory: player1.inventory, equipped: player1.equipped } }),
        User.updateOne({ username: player2.username }, { $set: { inventory: player2.inventory, equipped: player2.equipped } })
    ]).then(() => {
        // Notify both players of successful trade
        io.to(trade.player1).emit('tradeCompleted', { 
            message: 'החלפה הושלמה בהצלחה!',
            newInventory: player1.inventory,
            newEquipped: player1.equipped
        });
        io.to(trade.player2).emit('tradeCompleted', { 
            message: 'החלפה הושלמה בהצלחה!',
            newInventory: player2.inventory,
            newEquipped: player2.equipped
        });
        // Clean up
        delete activeTrades[tradeId];
        // Remove both players from in-trade list
        playersInTrade.delete(trade.player1);
        playersInTrade.delete(trade.player2);
        io.emit('playersInTrade', Array.from(playersInTrade));
    }).catch(err => {
        // Handle DB error
        io.to(trade.player1).emit('tradeCompleted', { 
            message: 'הייתה שגיאה בשמירת ההחלפה למסד הנתונים!',
            newInventory: player1.inventory,
            newEquipped: player1.equipped
        });
        io.to(trade.player2).emit('tradeCompleted', { 
            message: 'הייתה שגיאה בשמירת ההחלפה למסד הנתונים!',
            newInventory: player2.inventory,
            newEquipped: player2.equipped
        });
        delete activeTrades[tradeId];
    });
}

// Security function to handle violations (logging only for now)
function handleSecurityViolation(socketId, violationType, details = '') {
    if (!securityViolations[socketId]) {
        securityViolations[socketId] = { count: 0, violations: [] };
    }
    
    securityViolations[socketId].count++;
    securityViolations[socketId].violations.push({
        type: violationType,
        timestamp: Date.now(),
        details: details
    });
    
    console.log(`SECURITY VIOLATION: Socket ${socketId}, Type: ${violationType}, Count: ${securityViolations[socketId].count}, Details: ${details}`);
    
    // For now, just log violations without blocking
    // TODO: Re-enable blocking after testing
}

// Before emitting updatePlayers, add the room property to each player
function emitPlayersWithRooms() {
    const playersWithRooms = {};
    for (const [id, player] of Object.entries(players)) {
        const roomId = playerRooms[id];
        let homeOwner = null;
        
        // Check if player is in a home room and get the owner
        if (roomId && roomId.startsWith('home_') && homeRooms[roomId]) {
            homeOwner = homeRooms[roomId].owner;
        }
        
        playersWithRooms[id] = { 
            ...player, 
            room: roomId,
            targetX: player.targetX,
            targetY: player.targetY,
            homeOwner: homeOwner, // Add home owner information
            homeId: player.homeId // Add homeId for Friends Panel
        };
    }
    io.emit('updatePlayers', playersWithRooms);
}

// Helper function to get all rooms (including home rooms)
function getAllRooms() {
    const allRooms = { ...rooms };
    // Add home rooms
    Object.keys(homeRooms).forEach(homeId => {
        allRooms[homeId] = homeRooms[homeId];
    });
    return allRooms;
}

// Arcade API routes
app.get('/api/arcade/connected-users', (req, res) => {
  try {
    // Get actual connected users from the players object
    const connectedUsers = [];
    
    // Add real connected players
    Object.values(players).forEach(player => {
      if (player.username && !player.isAFK) {
        connectedUsers.push({
          username: player.username,
          status: 'online',
          room: playerRooms[player.id] || 'unknown'
        });
      }
    });
    
    // Add some bot users for atmosphere
    const botUsers = [
      { username: 'JumpiBot', status: 'online', room: 'arcade' },
      { username: 'GameMaster', status: 'online', room: 'arcade' }
    ];
    
    // Combine real users and bots, limit to 20 total
    const allUsers = [...connectedUsers, ...botUsers].slice(0, 20);
    
    res.json(allUsers);
  } catch (error) {
    console.error('Error getting connected users:', error);
    // Fallback to mock data
    const mockUsers = [
      { username: 'JumpiBot', status: 'online' },
      { username: 'GameMaster', status: 'online' }
    ];
    res.json(mockUsers);
  }
});

app.post('/api/arcade/award-coins', async (req, res) => {
  try {
    const { gameType, amount, score } = req.body;
    
    if (!req.session.userId) {
      return res.status(401).json({ error: 'לא מחובר' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Validate amount and score based on game type
    let maxAmount = 0;
    let maxScore = 0;
    
    switch (gameType) {

      case 'connectfour':
        maxAmount = 15;
        maxScore = 1;
        break;
      case 'memory':
        maxAmount = 60;
        maxScore = 30;
        break;
      case 'floppybird':
        maxAmount = 2000; // 2 coins per point, max 1000 points
        maxScore = 1000;
        break;
      default:
        maxAmount = 10;
        maxScore = 1;
    }

    // Validate score if provided
    if (score !== undefined && score > maxScore) {
      return res.status(400).json({ error: 'ניקוד לא חוקי' });
    }

    const finalAmount = Math.min(amount, maxAmount);
    user.coins = (user.coins || 0) + finalAmount;
    await user.save();

    res.json({ 
      success: true, 
      newCoins: user.coins, 
      awarded: finalAmount,
      score: score || 0
    });
  } catch (error) {
    console.error('Error awarding coins:', error);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

// Game routes
app.get('/games/tictactoe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', 'tictactoe.html'));
});

app.get('/games/connectfour', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', 'connectfour.html'));
});

app.get('/games/memory', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', 'memory.html'));
});

app.get('/arcade', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'arcade.html'));
});