/**
 * Stress Test - Load Testing
 * Goal: 100 orders per second
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const DURATION_SECONDS = 10;
const REQUESTS_PER_SECOND = 100;

async function sendOrder() {
  const orderData = {
    userId: `stress-user-${Math.floor(Math.random() * 100000)}`,
    items: [{ productId: 'p-stress', name: 'Stress Burger', quantity: 1, price: 10.0 }]
  };

  try {
    const start = Date.now();
    const res = await fetch(`${GATEWAY_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const latency = Date.now() - start;
    return { ok: res.ok, status: res.status, latency };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function runStressTest() {
  console.log(`\n🔥 Starting Stress Test...`);
  console.log(`📊 Target: ${REQUESTS_PER_SECOND} req/sec for ${DURATION_SECONDS}s`);
  console.log(`🔗 URL: ${GATEWAY_URL}/orders\n`);

  const results = {
    total: 0,
    success: 0,
    failed: 0,
    latencies: []
  };

  const startTime = Date.now();
  
  for (let s = 0; s < DURATION_SECONDS; s++) {
    console.log(`⏱️  Second ${s + 1}/${DURATION_SECONDS}...`);
    
    const batch = [];
    for (let i = 0; i < REQUESTS_PER_SECOND; i++) {
      batch.push(sendOrder().then(res => {
        results.total++;
        if (res.ok) {
          results.success++;
          results.latencies.push(res.latency);
        } else {
          results.failed++;
        }
      }));
    }
    
    await Promise.all(batch);
    // Adjust timing to maintain the rate approximately
    const elapsed = Date.now() - startTime;
    const expectedElapsed = (s + 1) * 1000;
    if (elapsed < expectedElapsed) {
      await new Promise(r => setTimeout(r, expectedElapsed - elapsed));
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;

  console.log('\n--- 📈 STRESS TEST RESULTS ---');
  console.log(`Total Requests:  ${results.total}`);
  console.log(`Success:         ${results.success} ( ${((results.success/results.total)*100).toFixed(2)}% )`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`Avg Latency:     ${avgLatency.toFixed(2)}ms`);
  console.log(`Throughput:      ${(results.total / totalTime).toFixed(2)} req/sec`);
  console.log('-------------------------------\n');
}

runStressTest();
