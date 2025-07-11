// Store configuration
const STORE_PACKAGES = [
  {
    id: 1,
    name: 'חבילת 10 אלף מטבעות',
    description: '10,000 מטבעות',
    amount: '10,000 מטבעות',
    imagePath: 'store/images/1.png',
    price: 15,
    currency: 'ILS',
    coinsReward: 10000,
    diamondsReward: 0
  },
  {
    id: 2,
    name: 'חבילת 25 אלף מטבעות',
    description: '25,000 מטבעות',
    amount: '25,000 מטבעות',
    imagePath: 'store/images/2.png',
    price: 30,
    currency: 'ILS',
    coinsReward: 25000,
    diamondsReward: 0
  },
  {
    id: 3,
    name: 'חבילת 50 אלף מטבעות',
    description: '50,000 מטבעות',
    amount: '50,000 מטבעות',
    imagePath: 'store/images/3.png',
    price: 55,
    currency: 'ILS',
    coinsReward: 50000,
    diamondsReward: 0
  },
  {
    id: 4,
    name: 'חבילת 5 אלף יהלומים',
    description: '5,000 יהלומים',
    amount: '5,000 יהלומים',
    imagePath: 'store/images/4.png',
    price: 40,
    currency: 'ILS',
    coinsReward: 0,
    diamondsReward: 5000
  },
  {
    id: 5,
    name: 'חבילת 8 אלף יהלומים',
    description: '8,000 יהלומים',
    amount: '8,000 יהלומים',
    imagePath: 'store/images/5.png',
    price: 60,
    currency: 'ILS',
    coinsReward: 0,
    diamondsReward: 8000
  },
  {
    id: 6,
    name: 'חבילת 13 אלף יהלומים',
    description: '13,000 יהלומים',
    amount: '13,000 יהלומים',
    imagePath: 'store/images/6.png',
    price: 95,
    currency: 'ILS',
    coinsReward: 0,
    diamondsReward: 13000
  }
];

// PayPal configuration
const PAYPAL_CONFIG = {
  sandbox: {
    clientId: 'Ae9bsaJaE1qoiNErxoh7Efrxl9rpNxaT5WWdzWW5ZUerWYTPraTcr4ivWl8YMEYUhVTKWOrRC4W-EPUi',
    clientSecret: 'ED--H9WhaeZ6NxYWHmeLZjHoQf6uL1FhS2ULfNaGWs2LG25VUCN4S7e9BYWAq77YhznivuN4UMuSOAUo',
    baseUrl: 'https://api-m.sandbox.paypal.com'
  },
  production: {
    clientId: 'AZsl0mkba39bA26Uw8TFo6W2sSFkSRAoOjWi2O0v3vAW0-YJIAsvhR1qKJD1huAa-5AbDgynmWjLncTt',
    clientSecret: 'EFfR8VgsNg7FGPdCoSwrPp-7y8t2dH0Wkjc8sXN3xHrDuD5DgvF0cN87VgqZ_k_u-rFWU0VSRzrtVKaO',
    baseUrl: 'https://api-m.paypal.com'
  }
};

// Get current environment config
const getPayPalConfig = () => {
  return PAYPAL_CONFIG.production; // Using production for live payments
};

module.exports = {
  STORE_PACKAGES,
  PAYPAL_CONFIG,
  getPayPalConfig
}; 