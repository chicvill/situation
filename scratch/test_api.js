const SERVICE_KEY = '7b4dc7644f01119fec7f1095c191de73571c79a25d3a62b69610802522a07d37';
const b_no = '5871301146';
const start_dt = '20191216';
const p_nm = '김종심';
const b_nm = '시크빌';

async function testEncoded() {
    console.log('--- Testing ENCODED key ---');
    const encodedKey = encodeURIComponent(SERVICE_KEY);
    const url = `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${encodedKey}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                businesses: [{
                    b_no: b_no,
                    start_dt: start_dt,
                    p_nm: p_nm,
                    b_nm: b_nm,
                    p_nm2: '',
                    corp_no: '',
                    b_sector: '',
                    b_type: ''
                }]
            })
        });
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}

async function testUnencoded() {
    console.log('\n--- Testing UNENCODED key ---');
    const url = `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${SERVICE_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                businesses: [{
                    b_no: b_no,
                    start_dt: start_dt,
                    p_nm: p_nm,
                    b_nm: b_nm,
                    p_nm2: '',
                    corp_no: '',
                    b_sector: '',
                    b_type: ''
                }]
            })
        });
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}

async function run() {
    await testEncoded();
    await testUnencoded();
}

run();
