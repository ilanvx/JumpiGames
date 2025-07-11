const express = require('express');
const router = express.Router();
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const { STORE_PACKAGES } = require('./config/store');
const paypalService = require('./services/paypalService');

console.log('=== PAYPAL PRODUCTION MODE ENABLED ===');
console.log('💰 All payments will be processed as real transactions');
console.log('🔒 Live PayPal integration active');
console.log('📊 Transaction logging with environment tracking');
console.log('Store routes loaded, packages:', STORE_PACKAGES);

// Debug route to test if store routes are working
router.get('/test', (req, res) => {
  console.log('Store test route accessed');
  res.json({ message: 'Store routes are working', packages: STORE_PACKAGES });
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  console.log('Auth check for:', req.session.username);
  if (!req.session.username) {
    console.log('Authentication failed - no username in session');
    return res.status(401).json({ error: 'Authentication required' });
  }
  console.log('Authentication successful');
  next();
};

// Get store packages
router.get('/packages', requireAuth, (req, res) => {
  try {
    console.log('Store packages requested by:', req.session.username);
    console.log('Available packages:', STORE_PACKAGES);
    res.json({ packages: STORE_PACKAGES });
  } catch (error) {
    console.error('Error getting store packages:', error);
    res.status(500).json({ error: 'Failed to get store packages' });
  }
});

// Create PayPal order
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { packageId } = req.body;
    
    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    const packageData = STORE_PACKAGES.find(pkg => pkg.id === parseInt(packageId));
    if (!packageData) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    // Get user info
    const user = await User.findOne({ username: req.session.username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create return URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${baseUrl}/store/success`;
    const cancelUrl = `${baseUrl}/store/cancel`;
    
    console.log('=== PAYPAL PRODUCTION ORDER CREATION ===');
    console.log('User:', req.session.username);
    console.log('Package:', packageData.name, 'Price:', packageData.price, 'ILS');
    console.log('Environment: PRODUCTION (LIVE PAYMENTS)');
    console.log('Created return URLs:', { 
      baseUrl,
      returnUrl, 
      cancelUrl
    });

    // Create PayPal order
    console.log('Creating PayPal PRODUCTION order for package:', packageData.id);
    const paypalOrder = await paypalService.createOrder(packageData, returnUrl, cancelUrl);
    console.log('PayPal PRODUCTION order created:', paypalOrder.id);

    // Create transaction record
    const transaction = new Transaction({
      userId: user._id,
      username: user.username,
      packageId: packageData.id,
      packageName: packageData.name,
      packageDescription: packageData.description,
      amountPaid: packageData.price,
      currency: packageData.currency,
      coinsAdded: packageData.coinsReward,
      diamondsAdded: packageData.diamondsReward,
      paypalOrderId: paypalOrder.id,
      status: 'pending',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      environment: 'production' // Mark as production transaction
    });

    console.log('Creating PRODUCTION transaction:', {
      paypalOrderId: paypalOrder.id,
      username: user.username,
      packageId: packageData.id,
      environment: 'production'
    });

    await transaction.save();
    console.log('PRODUCTION transaction saved successfully');

    res.json({
      orderId: paypalOrder.id,
      approvalUrl: paypalOrder.links.find(link => link.rel === 'approve').href
    });

  } catch (error) {
    console.error('Error creating PayPal PRODUCTION order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Handle PayPal return (success)
router.get('/success', requireAuth, async (req, res) => {
  try {
    const { token, PayerID } = req.query;
    
    if (!token || !PayerID) {
      return res.status(400).json({ error: 'Token and PayerID are required' });
    }

    console.log('=== PAYPAL PRODUCTION PAYMENT CAPTURE ===');
    console.log('Processing PayPal PRODUCTION return with token:', token, 'PayerID:', PayerID);

    // First, we need to capture the payment using the token
    try {
      const captureResult = await paypalService.capturePayment(token);
      console.log('PRODUCTION payment captured:', captureResult.status);
      
      if (captureResult.status === 'COMPLETED') {
        // Find the transaction by PayPal order ID
        console.log('Looking for PRODUCTION transaction with paypalOrderId:', token);
        const transaction = await Transaction.findOne({ paypalOrderId: token });
        if (!transaction) {
          console.log('No PRODUCTION transaction found for order ID:', token);
          // Let's also check if there are any pending transactions for this user
          const pendingTransactions = await Transaction.find({ 
            username: req.session.username, 
            status: 'pending' 
          });
          console.log('Pending PRODUCTION transactions for user:', pendingTransactions);
          return res.status(404).json({ error: 'Transaction not found' });
        }

        // Verify the transaction belongs to the current user
        if (transaction.username !== req.session.username) {
          return res.status(403).json({ error: 'Unauthorized access to transaction' });
        }

        // Update transaction with payment details
        transaction.status = 'completed';
        transaction.paypalPaymentId = captureResult.purchase_units[0]?.payments?.captures?.[0]?.id;
        transaction.paypalCaptureId = captureResult.purchase_units[0]?.payments?.captures?.[0]?.id;
        transaction.completedAt = new Date();
        transaction.environment = 'production';
        await transaction.save();

        // Credit the user's account
        const user = await User.findOne({ username: req.session.username });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Update user's coins and diamonds
        const packageData = STORE_PACKAGES.find(pkg => pkg.id === transaction.packageId);
        if (packageData) {
          const oldCoins = user.coins;
          const oldDiamonds = user.diamonds;
          user.coins += packageData.coinsReward;
          user.diamonds += packageData.diamondsReward;
          await user.save();
          
          console.log('PRODUCTION payment completed successfully:');
          console.log('User:', user.username);
          console.log('Package:', packageData.name);
          console.log('Amount paid:', packageData.price, 'ILS');
          console.log('Coins added:', packageData.coinsReward, '(', oldCoins, '->', user.coins, ')');
          console.log('Diamonds added:', packageData.diamondsReward, '(', oldDiamonds, '->', user.diamonds, ')');
        }

        // Send success response
        res.json({
          success: true,
          message: 'Payment completed successfully',
          coinsAdded: packageData.coinsReward,
          diamondsAdded: packageData.diamondsReward,
          newCoins: user.coins,
          newDiamonds: user.diamonds
        });
      } else {
        console.log('PRODUCTION payment not completed. Status:', captureResult.status);
        return res.redirect('/store-failed.html?reason=' + encodeURIComponent('התשלום לא הושלם.'));
      }
    } catch (captureError) {
      console.error('Error capturing PRODUCTION payment:', captureError);
      return res.redirect('/store-failed.html?reason=' + encodeURIComponent('שגיאה באישור התשלום.')); // capture error
    }

  } catch (error) {
    console.error('Error processing PRODUCTION payment success:', error);
    return res.redirect('/store-failed.html?reason=' + encodeURIComponent('שגיאה בעיבוד התשלום.')); // general error
  }
});

// Handle PayPal cancel
router.get('/cancel', requireAuth, (req, res) => {
  res.redirect('/store-failed.html?reason=' + encodeURIComponent('התשלום בוטל על ידך. לא חויבת.'));
});

// Get user's transaction history
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.session.username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ transactions });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({ error: 'Failed to get transaction history' });
  }
});

// Webhook for PayPal IPN (optional, for additional security)
router.post('/webhook', async (req, res) => {
  try {
    // In a production environment, you would verify the webhook signature
    // For now, we'll just acknowledge receipt
    console.log('PayPal webhook received:', req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

module.exports = router; 