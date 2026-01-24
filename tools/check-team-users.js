const { createStrapi } = require('@strapi/strapi');

async function checkTeamUsers() {
    const strapi = await createStrapi();
    await strapi.load();

    console.log('\n=== Checking Team Users ===\n');

    const teams = await strapi.db.query('api::team.team').findMany({
        populate: ['Users'],
    });

    teams.forEach(team => {
        console.log(`Team: ${team.Name} (ID: ${team.id})`);
        if (team.Users && team.Users.length > 0) {
            console.log(`  Users (${team.Users.length}):`);
            team.Users.forEach(user => {
                console.log(`    - ${user.firstname} ${user.lastname} (ID: ${user.id})`);
            });
        } else {
            console.log(`  Users: NONE`);
        }
        console.log('');
    });

    // Also check from admin::user side
    console.log('\n=== Checking Admin Users with Team ===\n');
    const users = await strapi.db.query('admin::user').findMany({
        populate: ['team'],
    });

    users.forEach(user => {
        console.log(`User: ${user.firstname} ${user.lastname} (ID: ${user.id})`);
        console.log(`  Team: ${user.team ? user.team.Name : 'NOT ASSIGNED'}`);
    });

    await strapi.destroy();
}

checkTeamUsers().catch(console.error);
