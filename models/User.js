const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  banned: { type: Boolean, default: false },
  coins: { type: Number, default: 0 },
  diamonds: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
  equipped: { type: mongoose.Schema.Types.Mixed, default: {} },
  isAdmin: { type: Boolean, default: false },
  homeId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
