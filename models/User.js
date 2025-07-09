const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  banned: { type: Boolean, default: false },
  coins: { type: Number, default: 0 },
  inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
  equipped: { type: mongoose.Schema.Types.Mixed, default: {} },
  isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
