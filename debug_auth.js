const strapiFactory = require('@strapi/strapi');
const bcrypt = require('bcryptjs');

async function run() {
    try {
        // Initialize Strapi (v4/v5 compatible factory)
        // Sometimes it's exported directly or as a factory
        const app = await strapiFactory.createStrapi({ distDir: './dist' }).load();

        console.log('---------------------------------------------------');
        console.log('--- DEBUGGING PORTAL ADMINS ---');

        // 1. List All Portal Admins
        // Note: Use 'api::portal-admin.portal-admin'
        const users = await app.db.query('api::portal-admin.portal-admin').findMany({
            populate: ['Team', 'Company']
        });

        console.log(`Found ${users.length} Portal Admins:`);
        users.forEach(u => {
            console.log(`- ID: ${u.id} | Email: "${u.Email}" | Team: ${u.Team?.Name || 'None'} | PwdLength: ${u.Password?.length}`);
        });

        // 2. Force Reset
        const targetEmail = 'ertunc.eryilmaz@niceye.com';
        const targetUser = users.find(u => u.Email.toLowerCase() === targetEmail.toLowerCase());

        if (targetUser) {
            console.log(`\nFound target user: ${targetEmail} (ID: ${targetUser.id}). Resetting password to '123456'...`);

            // Hash '123456'
            const newHash = await bcrypt.hash('123456', 10);

            // Update logic
            await app.db.query('api::portal-admin.portal-admin').update({
                where: { id: targetUser.id },
                data: { Password: newHash }
            });

            console.log('✅ Password successfully updated to "123456".');
        } else {
            console.error(`\n❌ ERROR: User "${targetEmail}" NOT FOUND in api::portal-admin.portal-admin!`);
            console.log('Please check the list above for the correct email address.');
        }

        console.log('---------------------------------------------------');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
