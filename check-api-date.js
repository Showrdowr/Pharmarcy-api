async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/v1/audit-logs?limit=1');
    const data = await res.json();
    if (data.data && data.data.data && data.data.data.length > 0) {
      console.log('Raw API Response (First Item):', JSON.stringify(data.data.data[0], null, 2));
      console.log('createAt value:', data.data.data[0].createAt);
    } else {
      console.log('No data found in response:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
test();
