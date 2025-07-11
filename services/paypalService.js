const axios = require('axios');
const { getPayPalConfig } = require('../config/store');

class PayPalService {
  constructor() {
    this.config = getPayPalConfig();
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Log the environment being used
    console.log('PayPal Service initialized with environment:', this.config.baseUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUCTION');
    console.log('PayPal Base URL:', this.config.baseUrl);
  }

  // Get PayPal access token
  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      
      const response = await axios.post(`${this.config.baseUrl}/v1/oauth2/token`, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 50 minutes (tokens expire after 1 hour)
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('PayPal authentication error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with PayPal');
    }
  }

  // Create PayPal order
  async createOrder(packageData, returnUrl, cancelUrl) {
    try {
      console.log('Creating PayPal order with data:', {
        packageData,
        returnUrl,
        cancelUrl
      });
      
      const accessToken = await this.getAccessToken();
      
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: packageData.currency,
              value: packageData.price.toString()
            },
            description: `${packageData.name} - ${packageData.description}`,
            custom_id: packageData.id.toString()
          }
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: 'Jumpi Games',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING'
        }
      };

      console.log('PayPal order data:', orderData);

      const response = await axios.post(
        `${this.config.baseUrl}/v2/checkout/orders`,
        orderData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('PayPal order response:', response.data);
      return response.data;
    } catch (error) {
      console.error('PayPal order creation error:', error.response?.data || error.message);
      throw new Error('Failed to create PayPal order');
    }
  }

  // Capture PayPal payment
  async capturePayment(orderId) {
    try {
      console.log('Capturing payment for order ID:', orderId);
      const accessToken = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.config.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('PayPal capture response:', response.data);
      return response.data;
    } catch (error) {
      console.error('PayPal payment capture error:', error.response?.data || error.message);
      throw new Error('Failed to capture PayPal payment');
    }
  }

  // Get order details
  async getOrderDetails(orderId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.config.baseUrl}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('PayPal order details error:', error.response?.data || error.message);
      throw new Error('Failed to get PayPal order details');
    }
  }

  // Verify payment status
  async verifyPayment(orderId) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      
      if (orderDetails.status === 'COMPLETED') {
        const capture = orderDetails.purchase_units[0]?.payments?.captures?.[0];
        if (capture && capture.status === 'COMPLETED') {
          return {
            verified: true,
            captureId: capture.id,
            paymentId: capture.id,
            amount: capture.amount.value,
            currency: capture.amount.currency_code
          };
        }
      }
      
      return { verified: false };
    } catch (error) {
      console.error('PayPal payment verification error:', error);
      return { verified: false, error: error.message };
    }
  }
}

module.exports = new PayPalService(); 