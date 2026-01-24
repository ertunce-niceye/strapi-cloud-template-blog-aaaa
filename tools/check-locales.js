const { createStrapi } = require('@strapi/strapi');

async function checkLocales() {
    const strapi = await createStrapi();
    await strapi.load();

    console.log('\n=== Checking OnDemand Video Locales ===\n');

    const teamUno = await strapi.db.query('api::team.team').findOne({
        where: { Name: 'Team Uno' },
    });

    const videos = await strapi.db.query('api::ondemand-video.ondemand-video').findMany({
        where: {
            Team: { id: teamUno.id }
        },
    });

    console.log(`Team Uno videos (Total: ${videos.length}):\n`);
    videos.forEach(v => {
        console.log(`ID ${v.id}: ${v.VideoTitle}`);
        console.log(`  Locale: ${v.locale || 'NOT SET'}`);
        console.log(`  PublishedAt: ${v.publishedAt || 'NOT PUBLISHED'}`);
        console.log('');
    });

    await strapi.destroy();
}

checkLocales().catch(console.error);
