const { createStrapi } = require('@strapi/strapi');

async function checkPublishStatus() {
    const strapi = await createStrapi();
    await strapi.load();

    const teamUno = await strapi.db.query('api::team.team').findOne({
        where: { Name: 'Team Uno' },
    });

    console.log('\n=== Team Uno Records ===\n');

    // Check Speakers
    console.log('SPEAKERS:');
    const speakers = await strapi.db.query('api::speaker.speaker').findMany({
        where: { Team: { id: teamUno.id } },
        populate: ['Company'],
    });
    speakers.forEach(s => {
        console.log(`  ${s.Full_Name}`);
        console.log(`    Company: ${s.Company ? s.Company.CompanyName : 'NULL'}`);
        console.log(`    Published: ${s.publishedAt ? 'YES' : 'NO (DRAFT)'}`);
    });
    console.log('');

    // Check Webinars
    console.log('WEBINARS:');
    const webinars = await strapi.db.query('api::webinar.webinar').findMany({
        where: { Team: { id: teamUno.id } },
        populate: ['Company'],
    });
    webinars.forEach(w => {
        console.log(`  ${w.Webinar_Title}`);
        console.log(`    Company: ${w.Company ? w.Company.CompanyName : 'NULL'}`);
        console.log(`    Published: ${w.publishedAt ? 'YES' : 'NO (DRAFT)'}`);
    });
    console.log('');

    // Check OnDemand Videos
    console.log('ONDEMAND VIDEOS:');
    const videos = await strapi.db.query('api::ondemand-video.ondemand-video').findMany({
        where: { Team: { id: teamUno.id } },
        populate: ['Company'],
    });
    videos.forEach(v => {
        console.log(`  ${v.VideoTitle}`);
        console.log(`    Company: ${v.Company ? v.Company.CompanyName : 'NULL'}`);
        console.log(`    Published: ${v.publishedAt ? 'YES' : 'NO (was DRAFT)'}`);
    });

    await strapi.destroy();
}

checkPublishStatus().catch(console.error);
