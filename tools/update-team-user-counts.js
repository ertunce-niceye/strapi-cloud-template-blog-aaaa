const { createStrapi } = require('@strapi/strapi');

async function updateTeamUserCounts() {
    const strapi = await createStrapi();
    await strapi.load();

    console.log('\n=== Updating Team User Counts ===\n');

    const teams = await strapi.db.query('api::team.team').findMany();

    for (const team of teams) {
        const userCount = await strapi.db.query('admin::user').count({
            where: { team: { id: team.id } },
        });

        await strapi.db.query('api::team.team').update({
            where: { id: team.id },
            data: { AssignedUsers: userCount },
        });

        console.log(`Team: ${team.Name} → AssignedUsers updated to ${userCount}`);
    }

    console.log('\n✅ All Team AssignedUsers counts updated!\n');

    await strapi.destroy();
}

updateTeamUserCounts().catch(console.error);
