const { createStrapi } = require('@strapi/strapi');

(async () => {
    try {
        const strapi = await createStrapi({ distDir: process.cwd() }).load();

        console.log('\n================ MEDIA DUMP ================\n');

        const files = await strapi.db.query('plugin::upload.file').findMany({
            populate: ['company', 'related'] // 'related' might show where it's used
        });

        files.forEach(f => {
            const comp = f.company ? `ID: ${f.company.id} (${f.company.CompanyName})` : "NULL";
            console.log(`[ID: ${f.id}] Name: ${f.name} | CreatedAt: ${f.createdAt} | Company: ${comp}`);
        });

        console.log('\n============================================\n');

        process.exit(0);
    } catch (error) {
        console.error('ERROR:', error);
        process.exit(1);
    }
})();
