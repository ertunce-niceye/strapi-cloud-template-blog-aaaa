const http = require('http');

const token = "437580a07870946787e31ae71abbefe17a7dcbd374c025944455399dc5af1b91ba4111ee8d09a21733875d7238b58f01626674e0f497116296f69b3290511168f7a4b813194363599c0703f611544399b75920236c436f2c8972d7329b5ded9f2dc17ff9b9079696b36eda661a67a2448730a3425121a122c3c9968efb886cd0";

const options = {
    hostname: 'localhost',
    port: 1337,
    path: '/api/companies?filters[CompanyName][$eq]=company-p&populate=*',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        try {
            console.log('Body:', JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log('Body (Raw):', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
