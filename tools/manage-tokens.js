const { createStrapi } = require('@strapi/strapi');

async function main() {
    // Initialize Strapi
    const strapi = await createStrapi();
    await strapi.load();

    try {
        console.log('--- Listing API Tokens ---');

        // In Strapi v4/v5, API Tokens are usually 'admin::api-token'
        const tokens = await strapi.db.query('admin::api-token').findMany({
            populate: ['permissions']
        });

        if (tokens.length === 0) {
            console.log('No API tokens found.');
        } else {
            tokens.forEach(t => {
                console.log(`ID: ${t.id}`);
                console.log(`Name: ${t.name}`);
                console.log(`Description: ${t.description}`);
                console.log(`Type: ${t.type}`); // read-only, full-access, custom
                console.log(`Access Key (Token): ${t.accessKey}`);
                console.log('---------------------------');
            });
        }

        // Create a new token
        const existing = await strapi.db.query('admin::api-token').findOne({ where: { name: 'Frontend_Agent_Token' } });
        if (existing) {
            await strapi.db.query('admin::api-token').delete({ where: { id: existing.id } });
        }

        const newToken = await strapi.service('admin::api-token').create({
            name: 'Frontend_Agent_Token',
            description: 'Auto-generated for frontend',
            type: 'full-access',
            lifespan: null
        });

        console.log('--- NEW TOKEN CREATED ---');
        console.log(`Access Key: ${newToken.accessKey}`);
        console.log('-------------------------');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        strapi.destroy();
        process.exit(0);
    }
}

main();
