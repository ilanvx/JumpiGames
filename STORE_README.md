# Jumpi Store - PayPal Integration

## Overview
This document describes the PayPal store integration for the Jumpi game, which allows users to purchase coins and diamonds using PayPal Sandbox for testing.

## Features

### ✅ Completed Features
- **Authentication Required**: Users must be logged in to purchase packages
- **6 Store Packages**: Pre-configured packages with different coin/diamond rewards
- **PayPal Sandbox Integration**: Secure payment processing using PayPal REST API
- **Server-side Validation**: Payment verification before crediting user accounts
- **Transaction Logging**: All purchases logged in MongoDB with detailed information
- **Modern UI**: Responsive design with Hebrew RTL support
- **Security**: Server-side validation, no client-side secrets exposed

### Store Packages

| ID | Name | Description | Amount | Price (ILS) |
|----|------|-------------|--------|-------------|
| 1 | חבילת מטבעות | 10,000 מטבעות | +10,000 coins | ₪15 |
| 2 | החבילת מטבעות המשודרגת | 25,000 מטבעות | +25,000 coins | ₪30 |
| 3 | החבילת מטבעות המשודרגתתתת | 50,000 מטבעות | +50,000 coins | ₪55 |
| 4 | חבילת יהלומים | 5,000 יהלומים | +5,000 diamonds | ₪40 |
| 5 | חבילת יהלומים משודרגת | 8,000 יהלומים | +8,000 diamonds | ₪60 |
| 6 | חבילת יהלומים מאוד משודרגת | 13,000 יהלומים | +13,000 diamonds | ₪95 |

## Technical Implementation

### Files Created/Modified

#### Backend Files
- `models/Transaction.js` - MongoDB schema for transaction logging
- `config/store.js` - Store configuration and PayPal settings
- `services/paypalService.js` - PayPal REST API integration
- `storeRoutes.js` - Express routes for store functionality
- `server.js` - Added store routes integration

#### Frontend Files
- `public/store.html` - Store UI with modern design
- `public/store.js` - Client-side store functionality
- `public/game.html` - Added store navigation links

### PayPal Configuration
- **Environment**: Sandbox (for testing)
- **Currency**: ILS (Israeli Shekel)
- **Client ID**: `Ae9bsaJaE1qoiNErxoh7Efrxl9rpNxaT5WWdzWW5ZUerWYTPraTcr4ivWl8YMEYUhVTKWOrRC4W-EPUi`
- **Secret Key**: `ED--H9WhaeZ6NxYWHmeLZjHoQf6uL1FhS2ULfNaGWs2LG25VUCN4S7e9BYWAq77YhznivuN4UMuSOAUo`

### Security Features
1. **Server-side Payment Verification**: All payments verified via PayPal REST API
2. **Authentication Required**: Users must be logged in to access store
3. **Transaction Logging**: Complete audit trail of all purchases
4. **No Client-side Secrets**: PayPal credentials only on server
5. **Input Validation**: All user inputs sanitized and validated
6. **Replay Attack Prevention**: Unique transaction IDs and verification

### Database Schema

#### Transaction Model
```javascript
{
  userId: ObjectId,
  username: String,
  packageId: Number,
  packageName: String,
  packageDescription: String,
  amountPaid: Number,
  currency: String,
  coinsAdded: Number,
  diamondsAdded: Number,
  paypalOrderId: String,
  paypalPaymentId: String,
  paypalCaptureId: String,
  status: String, // 'pending', 'completed', 'failed', 'refunded'
  ipAddress: String,
  userAgent: String,
  createdAt: Date,
  completedAt: Date,
  errorMessage: String
}
```

## API Endpoints

### Store Routes
- `GET /store/packages` - Get available packages (requires auth)
- `POST /store/create-order` - Create PayPal order (requires auth)
- `GET /store/success` - Handle PayPal return (requires auth)
- `GET /store/cancel` - Handle PayPal cancel (requires auth)
- `GET /store/transactions` - Get user transaction history (requires auth)
- `POST /store/webhook` - PayPal webhook (optional)

### User Routes
- `GET /api/user` - Get current user info (requires auth)

## Usage

### For Users
1. Navigate to `/store` or click the store button in the game
2. If not logged in, you'll see a login prompt
3. Browse available packages
4. Click "קנה עכשיו" (Buy Now) on any package
5. Complete payment via PayPal
6. Return to game with updated currency

### For Developers
1. Start the server: `node server.js`
2. Access store at: `http://localhost:3003/store`
3. Test with PayPal Sandbox credentials
4. Monitor transactions in MongoDB

## Testing

### PayPal Sandbox Testing
- Use PayPal Sandbox accounts for testing
- Test both successful and failed payments
- Verify transaction logging in MongoDB
- Check user currency updates

### Security Testing
- Test authentication requirements
- Verify server-side payment validation
- Check for proper error handling
- Test transaction logging

## Future Enhancements

### Planned Features
- [ ] Admin panel for price management
- [ ] Discount codes and promotions
- [ ] Subscription packages
- [ ] Gift cards
- [ ] Multiple payment methods
- [ ] Advanced analytics

### Production Considerations
- [ ] Move to PayPal Production environment
- [ ] Implement webhook signature verification
- [ ] Add rate limiting
- [ ] Enhanced error logging
- [ ] Backup and recovery procedures

## Troubleshooting

### Common Issues
1. **PayPal Authentication Errors**: Check client ID and secret
2. **Database Connection**: Ensure MongoDB is running
3. **Session Issues**: Check session configuration
4. **Payment Verification**: Verify PayPal order status

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
DEBUG=paypal:*
NODE_ENV=development
```

## Dependencies
- `axios` - HTTP client for PayPal API
- `mongoose` - MongoDB ODM
- `express-session` - Session management
- `bcrypt` - Password hashing

## License
This store integration is part of the Jumpi game project. 