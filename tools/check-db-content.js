const strapi = require('@strapi/strapi');

async function checkContent() {
    const app = await strapi.createStrapi({ distDir: './dist' }).load();

    try {
        const webinarCount = await app.db.query('api::webinar.webinar').count();
        const userCount = await app.db.query('admin::user').count();
        const companyCount = await app.db.query('api::company.company').count();

        console.log('--------------------------------------------------');
        console.log(`Webinars Found: ${webinarCount}`);
        console.log(`Admin Users Found: ${userCount}`);
        console.log(`Companies Found: ${companyCount}`);
        console.log('--------------------------------------------------');

        if (webinarCount > 0) {
            const webinars = await app.db.query('api::webinar.webinar').findMany({ limit: 3 });
            console.log('Sample Webinars:', webinars.map(w => w.Webinar_Title || w.Title));
        }

    } catch (error) {
        console.error('Error checking content:', error);
    } finally {
        app.stop();
        process.exit(0);
    }
}

checkContent();
