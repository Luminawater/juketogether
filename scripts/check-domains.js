const https = require('https');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

// Read domains from file
let domainsToCheck = [];
try {
  const filePath = path.join(__dirname, 'suggestions-names.txt');
  const content = fs.readFileSync(filePath, 'utf8');
  domainsToCheck = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('.'))
    .map(line => {
      // Extract domain if line contains it
      const match = line.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      return match ? match[1] : line;
    })
    .filter(domain => domain);
} catch (error) {
  console.error('Error reading suggestions-names.txt, using default list');
  domainsToCheck = [
    'juketogether.com',
    'jukesync.com',
    'jukeroom.com',
    'jukeparty.com',
    'jukespace.com'
  ];
}

console.log(`Found ${domainsToCheck.length} domains to check\n`);

// Function to check domain via DNS lookup
async function checkDomainDNS(domain) {
  try {
    await dns.resolve4(domain);
    return { available: false, method: 'DNS' };
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      // Domain doesn't resolve, might be available
      return { available: 'maybe', method: 'DNS' };
    }
    return { available: 'unknown', method: 'DNS', error: error.code };
  }
}

// Function to check via API Ninjas (free tier)
async function checkDomainAPI(domain) {
  return new Promise((resolve) => {
    const url = `https://api.api-ninjas.com/v1/domaincheck?domain=${domain}`;
    
    const options = {
      headers: {
        'X-Api-Key': '' // Free tier doesn't always require key, but might need one
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ available: !result.is_registered, method: 'API', data: result });
        } catch (e) {
          resolve({ available: 'unknown', method: 'API', error: e.message });
        }
      });
    }).on('error', (err) => {
      resolve({ available: 'unknown', method: 'API', error: err.message });
    });
  });
}

// Simple HTTP check
async function checkDomainHTTP(domain) {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      resolve({ available: false, method: 'HTTP', status: res.statusCode });
    });

    req.on('error', (err) => {
      if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        resolve({ available: 'maybe', method: 'HTTP' });
      } else {
        resolve({ available: 'unknown', method: 'HTTP', error: err.code });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ available: 'maybe', method: 'HTTP', error: 'timeout' });
    });

    req.end();
  });
}

// Main check function
async function checkDomain(domain) {
  console.log(`Checking ${domain}...`);
  
  // Try DNS first
  const dnsResult = await checkDomainDNS(domain);
  
  // If DNS says it might be available, try HTTP
  if (dnsResult.available === 'maybe') {
    const httpResult = await checkDomainHTTP(domain);
    return {
      domain,
      ...httpResult,
      dnsCheck: dnsResult
    };
  }
  
  return {
    domain,
    ...dnsResult
  };
}

// Check all domains in parallel
async function checkAllDomains() {
  console.log('Checking domain availability in parallel...\n');
  
  // Check all domains in parallel (with concurrency limit)
  const concurrency = 10;
  const results = [];
  
  for (let i = 0; i < domainsToCheck.length; i += concurrency) {
    const batch = domainsToCheck.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(domain => checkDomain(domain))
    );
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + concurrency < domainsToCheck.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log('\n=== RESULTS ===\n');
  
  const available = [];
  const taken = [];
  const unknown = [];
  
  results.forEach(result => {
    if (result.available === false) {
      taken.push(result.domain);
      console.log(`❌ ${result.domain} - TAKEN (${result.method})`);
    } else if (result.available === 'maybe') {
      available.push(result.domain);
      console.log(`✅ ${result.domain} - LIKELY AVAILABLE (${result.method})`);
    } else {
      unknown.push(result.domain);
      console.log(`❓ ${result.domain} - UNKNOWN (${result.method})`);
    }
  });
  
  console.log('\n=== SUMMARY ===');
  console.log(`\n✅ Likely Available (${available.length}):`);
  available.forEach(d => console.log(`   - ${d}`));
  
  console.log(`\n❌ Taken (${taken.length}):`);
  taken.forEach(d => console.log(`   - ${d}`));
  
  if (unknown.length > 0) {
    console.log(`\n❓ Unknown (${unknown.length}):`);
    unknown.forEach(d => console.log(`   - ${d}`));
  }
}

checkAllDomains().catch(console.error);

