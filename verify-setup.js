// Startup verification script for CosmeticGuard
console.log('CosmeticGuard Startup Verification');
console.log('='.repeat(50));

// Check if backend is running
async function checkBackend() {
  try {
    console.log('Checking backend server...');
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();
    console.log('Backend is running:', data.message);
    return true;
  } catch (error) {
    console.log('Backend not running');
    return false;
  }
}

// Check if frontend is accessible
async function checkFrontend() {
  try {
    console.log('Checking frontend server...');
    const response = await fetch('http://localhost:5173');
    if (response.ok) {
      console.log('Frontend is running on port 5173');
      return true;
    }
  } catch (error) {
    // Try port 5174
    try {
      const response2 = await fetch('http://localhost:5174');
      if (response2.ok) {
        console.log('Frontend is running on port 5174');
        return true;
      }
    } catch (error2) {
      console.log('Frontend not running');
      return false;
    }
  }
}

// Main verification
async function verify() {
  const backendRunning = await checkBackend();
  const frontendRunning = await checkFrontend();
  
  console.log('\n' + '='.repeat(50));
  
  if (backendRunning && frontendRunning) {
    console.log('Both servers are running successfully!');
    console.log('\nQuick Links:');
    console.log('   Frontend: http://localhost:5173 or http://localhost:5174');
    console.log('   Backend API: http://localhost:3001/api/health');
    console.log('   Test Search: Try "moisturizer" or "pelembap"');
  } else {
    console.log('Setup incomplete:');
    
    if (!backendRunning) {
      console.log('   Backend server not running');
      console.log('   Fix: npm run dev:backend');
    }
    
    if (!frontendRunning) {
      console.log('   Frontend server not running');
      console.log('   Fix: npm run dev');
    }
    
    console.log('\nOr start both together: npm run dev:full');
  }
  
  console.log('\nFor troubleshooting, see CORS_FIX.md');
}

verify().catch(console.error);
