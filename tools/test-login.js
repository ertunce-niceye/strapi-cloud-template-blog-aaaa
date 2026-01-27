async function testLogin() {
    try {
        const response = await fetch('http://localhost:1337/api/portal-admins/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'q@q.com', password: '123123' })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', data);
    } catch (e) {
        console.error(e);
    }
}
testLogin();
