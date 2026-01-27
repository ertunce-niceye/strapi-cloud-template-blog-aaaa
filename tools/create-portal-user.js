const strapi = require('@strapi/strapi');

async function createTestUser() {
    const app = await strapi.createStrapi({ distDir: './dist' }).load();

    try {
        // Check if user exists
        const existing = await app.db.query('api::portal-admin.portal-admin').findOne({
            where: { Email: 'customer@example.com' }
        });

        if (existing) {
            console.log('Test user already exists:', existing.Email);
            return;
        }

        // Passwords must be hashed? Does create entry hash it?
        // Strapi's user-permissions plugin handles hashing for 'up_users'.
        // For our custom 'portal-admin', if we marked 'Password' as just string?
        // Wait, in schema.json gave type: 'password'.
        // Does Strapi core automatically hash 'password' type on create?
        // NO. It requires lifecycle or manual hashing.
        // I NEED TO HASH IT MANUALLY OR ADD LIFECYCLE.
        // Let's create a lifecycle to hash password for 'portal-admin'.

        // For now, I will hash it manually here using bcryptjs if available or strapi util?
        // strapi.plugin('users-permissions').service('user').hashPassword(password);

        const password = 'password123';
        const hashedPassword = await app.plugin('users-permissions').service('user').hashPassword(password);

        const newUser = await app.entityService.create('api::portal-admin.portal-admin', {
            data: {
                Email: 'customer@example.com',
                Password: hashedPassword,
                FirstName: 'Demo',
                LastName: 'Customer',
                OTP_Enabled: false,
                // Team: 1 // Need a team ID?
            }
        });

        console.log('Created test user:', newUser);

    } catch (error) {
        console.error('Error creating user:', error);
    } finally {
        app.stop();
        process.exit(0);
    }
}

createTestUser();
