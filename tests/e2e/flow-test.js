/**
 * E2E Integration Test
 * Verifies: Gateway -> Orders Service -> Redis Queue -> Payments Service -> Gateway
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

async function runTest() {
  console.log('🚀 Starting E2E Integration Test...');
  console.log(`🔗 Target Gateway: ${GATEWAY_URL}`);

  const orderData = {
    userId: `user-test-${Date.now()}`,
    items: [
      { productId: 'p-001', name: 'Burger Deluxe', quantity: 2, price: 12.50 },
      { productId: 'p-002', name: 'Large Fries', quantity: 1, price: 4.00 }
    ]
  };

  try {
    // 1. Create Order
    console.log('\nStep 1: Creating order...');
    const createRes = await fetch(`${GATEWAY_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (!createRes.ok) throw new Error(`Failed to create order: ${createRes.statusText}`);
    const order = await createRes.json();
    console.log(`✅ Order created! ID: ${order.id} | Status: ${order.status}`);

    // 2. Poll for status change (asynchronous flow)
    console.log('\nStep 2: Waiting for payment processing (polling)...');
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`   Attempt ${attempts}/${maxAttempts}...`);
      
      const getRes = await fetch(`${GATEWAY_URL}/orders/${order.id}`);
      const updatedOrder = await getRes.json();
      
      console.log(`   Current Status: ${updatedOrder.status}`);
      
      if (updatedOrder.status === 'PAID') {
        console.log('\n✨ SUCCESS: Flow completed! Order is PAID.');
        console.log('--------------------------------------------------');
        console.log(JSON.stringify(updatedOrder, null, 2));
        console.log('--------------------------------------------------');
        return;
      }
      
      if (updatedOrder.status === 'FAILED') {
        throw new Error('❌ Flow failed: Payment was rejected.');
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    }

    throw new Error('❌ Timeout: Order status did not update in time.');

  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    process.exit(1);
  }
}

runTest();
