const { createStrapi } = require('@strapi/strapi');

async function checkAssignedUsers() {
    const strapi = await createStrapi();
    await strapi.load();

    console.log('\n=== Checking AssignedUsers Field ===\n');

    const teams = await strapi.db.query('api::team.team').findMany();

    teams.forEach(team => {
        console.log(`Team: ${team.Name}`);
        console.log(`  ID: ${team.id}`);
        console.log(`  AssignedUsers: ${team.AssignedUsers !== undefined ? team.AssignedUsers : 'FIELD NOT FOUND'}`);
        console.log(`  All fields:`, Object.keys(team));
        console.log('');
    });

    await strapi.destroy();
}

checkAssignedUsers().catch(console.error);
