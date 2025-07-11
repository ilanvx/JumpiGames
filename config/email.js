// Email configuration for contact form
module.exports = {
  // Gmail configuration
  service: 'gmail',
  auth: {
    user: 'jumpiiworld@gmail.com',
    // App Password שהוזן ע"י המשתמש
    pass: 'gqzk xffl ewux nkvs'
  },
  
  // Email settings
  from: 'jumpiiworld@gmail.com',
  to: 'jumpiiworld@gmail.com',
  
  // Rate limiting settings
  maxRequestsPerHour: 5,
  rateLimitWindow: 3600000, // 1 hour in milliseconds
  
  // Validation settings
  allowedDomains: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'],
  maxMessageLength: 2000,
  minMessageLength: 10
}; 