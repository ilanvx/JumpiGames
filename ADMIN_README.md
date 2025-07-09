# Jumpi Admin Panel

## Overview
The Jumpi Admin Panel provides comprehensive user and player management capabilities for the Jumpi game server.

## Features

### 🔐 Authentication
- Protected by admin token authentication
- Token: `YOUR_SECRET_ADMIN_TOKEN` (change this in production)

### 👥 Player Management
- **Online Players**: View all currently connected players with their usernames and socket IDs
- **Real-time Updates**: Auto-refreshes every 10 seconds
- **Manual Refresh**: Click "Refresh Data" button for immediate updates

### 👤 User Management
- **All Users**: View all registered users from the database
- **Ban/Unban**: Toggle user ban status with one click
- **Password Management**: Change user passwords securely with bcrypt hashing
- **Status Indicators**: Visual badges showing banned/active status

### 🛠️ Quick Actions
- **Export Data**: Download current admin data as JSON
- **Clear Cache**: Clear browser cache and localStorage
- **Auto Refresh Toggle**: Enable/disable automatic data refresh
- **Manual Refresh**: Force immediate data update

## API Endpoints

### GET /admin/players-online
Returns JSON array of currently connected players:
```json
[
  {
    "username": "player1",
    "socketId": "socket123"
  }
]
```

### GET /admin/users
Returns JSON array of all registered users:
```json
[
  {
    "username": "user1",
    "banned": false
  }
]
```

### POST /admin/ban-user
Ban or unban a user:
```json
{
  "username": "user1",
  "ban": true
}
```

### POST /admin/change-password
Change user password (automatically hashed):
```json
{
  "username": "user1",
  "newPassword": "newSecurePassword123"
}
```

## Security Features

### Authentication
- All admin routes require `x-admin-token` header
- Token must match `YOUR_SECRET_ADMIN_TOKEN`
- Returns 403 Forbidden for unauthorized access

### Password Security
- Passwords are hashed using bcrypt with salt rounds of 10
- Password confirmation required in UI
- Minimum 6 character password requirement

### Input Validation
- Username and password validation
- Boolean validation for ban status
- Error handling for all operations

## Usage

### Accessing the Admin Panel
1. Navigate to `http://localhost:3000/admin`
2. The panel will automatically load and refresh data

### Managing Users
1. **Ban a User**: Click the "Ban" button next to any active user
2. **Unban a User**: Click the "Unban" button next to any banned user
3. **Change Password**: 
   - Enter username in the password change form
   - Enter new password and confirmation
   - Click "Change Password"

### Monitoring Players
- View real-time online player count
- See socket IDs for debugging
- Monitor player status with visual indicators

## Technical Details

### Dependencies
- **bcrypt**: Password hashing
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **socket.io**: Real-time communication

### Database Schema Updates
The User model has been updated to include:
- `banned`: Boolean field for user ban status
- `coins`: Number field for user currency
- `inventory`: Mixed type for user items
- `equipped`: Mixed type for equipped items

### Server Integration
- Admin routes mounted at `/admin` path
- Players and usernames objects shared via `app.locals`
- Session middleware integration
- Static file serving for admin interface

## Security Recommendations

1. **Change Admin Token**: Replace `YOUR_SECRET_ADMIN_TOKEN` with a strong, unique token
2. **HTTPS**: Use HTTPS in production for secure communication
3. **Rate Limiting**: Consider adding rate limiting to admin endpoints
4. **Logging**: Implement comprehensive logging for admin actions
5. **Access Control**: Consider implementing role-based access control

## Troubleshooting

### Common Issues
1. **403 Forbidden**: Check that admin token is correct
2. **Database Errors**: Ensure MongoDB is running and accessible
3. **Password Issues**: Verify bcrypt is properly installed
4. **Auto-refresh Not Working**: Check browser console for JavaScript errors

### Debug Mode
Enable debug logging by checking browser console for detailed error messages and API responses.

## Future Enhancements

- User activity logs
- Advanced filtering and search
- Bulk operations
- Real-time notifications
- Audit trail
- Role-based permissions 