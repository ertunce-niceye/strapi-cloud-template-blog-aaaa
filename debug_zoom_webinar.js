require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

async function getAccessToken() {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    const accountId = process.env.ZOOM_ACCOUNT_ID;

    if (!clientId || !clientSecret || !accountId) {
        throw new Error('Zoom API credentials are missing.');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {}, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Auth Error:', error.response?.data || error.message);
        throw error;
    }
}

async function getWebinarDetails(webinarId) {
    try {
        const token = await getAccessToken();
        console.log(`Fetching details for Webinar ID: ${webinarId}`);

        const response = await axios.get(`https://api.zoom.us/v2/webinars/${webinarId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Webinar Details fetched. Writing to file...');
        fs.writeFileSync('webinar_details_out.json', JSON.stringify(response.data, null, 2));
        console.log('Successfully wrote to webinar_details_out.json');

    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
    }
}

// Webinar ID provided by user
const WEBINAR_ID = '87515677786';
getWebinarDetails(WEBINAR_ID);
