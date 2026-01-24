const { createStrapi } = require('@strapi/strapi');

async function checkTeamRelation() {
    const strapi = await createStrapi();
    await strapi.load();

    console.log('\n=== Checking OnDemand Video Team Relation ===\n');

    // Get Team Uno
    const teamUno = await strapi.db.query('api::team.team').findOne({
        where: { Name: 'Team Uno' },
    });

    console.log('Team Uno:');
    console.log(`  ID: ${teamUno.id}`);
    console.log(`  DocumentID: ${teamUno.documentId}`);
    console.log('');

    // Get OnDemand Videos with Team = Team Uno (using ID)
    console.log('Querying with Team ID...');
    const videosById = await strapi.db.query('api::ondemand-video.ondemand-video').findMany({
        where: {
            Team: { id: teamUno.id }
        },
        populate: ['Team'],
    });
    console.log(`Found ${videosById.length} videos using Team.id filter`);
    videosById.forEach(v => console.log(`  - ${v.VideoTitle} (ID: ${v.id})`));
    console.log('');

    // Get OnDemand Videos with Team = Team Uno (using DocumentID)
    console.log('Querying with Team DocumentID...');
    const videosByDocId = await strapi.db.query('api::ondemand-video.ondemand-video').findMany({
        where: {
            Team: { documentId: teamUno.documentId }
        },
        populate: ['Team'],
    });
    console.log(`Found ${videosByDocId.length} videos using Team.documentId filter`);
    videosByDocId.forEach(v => console.log(`  - ${v.VideoTitle} (ID: ${v.id})`));
    console.log('');

    // Check raw database structure
    console.log('Raw database check (first video with Team):');
    const rawVideos = await strapi.db.connection('ondemand_videos')
        .select('*')
        .whereNotNull('team_id')
        .limit(3);

    rawVideos.forEach(v => {
        console.log(`  Video ID ${v.id}: team_id = ${v.team_id}, team_document_id = ${v.team_document_id || 'N/A'}`);
    });

    await strapi.destroy();
}

checkTeamRelation().catch(console.error);
