const { createStrapi } = require('@strapi/strapi');

async function checkOnDemandVideos() {
    const strapi = await createStrapi();
    await strapi.load();

    console.log('\n=== OnDemand Videos ===');
    const videos = await strapi.db.query('api::ondemand-video.ondemand-video').findMany({
        populate: ['Team', 'Company'],
    });

    console.log(`Total OnDemand Videos: ${videos.length}\n`);

    videos.forEach((video, index) => {
        console.log(`${index + 1}. ${video.VideoTitle || 'Untitled'}`);
        console.log(`   ID: ${video.id}, DocumentID: ${video.documentId}`);
        console.log(`   Team: ${video.Team ? `${video.Team.Name} (ID: ${video.Team.id})` : 'NOT ASSIGNED'}`);
        console.log(`   Company: ${video.Company ? `${video.Company.CompanyName} (ID: ${video.Company.id})` : 'NOT ASSIGNED'}`);
        console.log('');
    });

    console.log('\n=== Teams ===');
    const teams = await strapi.db.query('api::team.team').findMany({
        populate: ['Company'],
    });

    teams.forEach((team) => {
        console.log(`Team: ${team.Name} (ID: ${team.id}, DocumentID: ${team.documentId})`);
        console.log(`  Company: ${team.Company ? team.Company.CompanyName : 'NOT ASSIGNED'}`);
    });

    await strapi.destroy();
}

checkOnDemandVideos().catch(console.error);
