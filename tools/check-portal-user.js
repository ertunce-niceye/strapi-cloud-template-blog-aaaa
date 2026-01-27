const strapi = require('@strapi/strapi');
const bcrypt = require('bcryptjs');

async function checkUser() {
    // Config loader needed? Usually Strapi loads env automatically if running from root?
    // If not, we might need dotenv.
    try {
        // Try to load dotenv just in case
        require('dotenv').config();
    } catch (e) { }

    const app = await strapi.createStrapi({ distDir: './dist' }).load();

    try {
        const users = await app.db.query('api::portal-admin.portal-admin').findMany({
            populate: ['Team', 'Company']
        });

        console.log(`Found ${users.length} portal admins.`);

        for (const user of users) {
            console.log('--------------------------------------------------');
            console.log(`ID: ${user.id}`);
            console.log(`Email: ${user.Email}`);
            console.log(`Password (Raw): ${user.Password}`);

            // Check if it looks like bcrypt
            const isHash = user.Password && user.Password.startsWith('$2a$');
            console.log(`Is Bcrypt Hash? ${isHash}`);

            if (isHash) {
                // Try to compare with '123123' just to test
                const match = await bcrypt.compare('123123', user.Password);
                console.log(`Matches '123123'? ${match}`);
            } else {
                // Try to compare as plain text? no, controller expects hash.
                console.log('Password is NOT hashed! Lifecycle failed.');
            }
        }

    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        app.stop();
        process.exit(0);
    }
}

checkUser();
