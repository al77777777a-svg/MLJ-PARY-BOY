const { Client } = require("discord.js");

async function test(token, name) {
    const c = new Client({ intents: [] });
    try {
        await c.login(token);
        console.log(`${name}: VALID (User: ${c.user.tag})`);
        c.destroy();
    } catch (e) {
        console.log(`${name}: INVALID (${e.message})`);
    }
}

async function run() {
    await test("MTU2MDMwMjIyNzYxMDkzMTIwMA.GuyTB7.paP9MLx55DSE1clR1p2UJ6017Us29ouIUzYlPM", "Old Token");
    await test("MTU2MDMwMjIyNzYxMDkzMTIwMA.GqJZ_V.zx-1YbKZXB8jjbsKmAs6o354LYEQW6IStKl0UM", "New Token with 0");
    await test("MTU2MDMwMjIyNzYxMDkzMTIwMA.GqJZ_V.zx-1YbKZXB8jjbsKmAs6o354LYEQW6IStKlOUM", "New Token with O");
}

run();
