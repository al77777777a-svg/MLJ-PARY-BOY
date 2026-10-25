const { Client } = require("discord.js");

const p1 = "MTU2MDMwMjIyNzYxMDkzMTIwMA";
const p2s = ["GqJZ_V", "GqJZ-V", "GqJZ.V"];
const p3_prefix = ["zx-", "zx_"];

async function tryLogin(token) {
    const c = new Client({ intents: [] });
    try {
        await c.login(token);
        console.log("SUCCESS! Valid token:", token);
        c.destroy();
        process.exit(0);
    } catch (e) {
        // fail
    }
}

async function main() {
    // Variations of characters that look similar in font:
    // zx[-/_]1[1/l/I]YbKZXB8jjbsKmAs6o354LYEQW6[I/l/1]StK[l/1/I][0/O]UM
    const var_p2 = ["GqJZ_V", "GqJZ-V"];
    const var_sep = ["-", "_"];
    const var_one = ["1", "l", "I"];
    const var_I = ["I", "l", "1"];
    const var_l = ["l", "1", "I"];
    const var_zero = ["0", "O", "o"];

    console.log("Testing variations...");
    for (const p2 of var_p2) {
        for (const s of var_sep) {
            for (const o of var_one) {
                for (const i of var_I) {
                    for (const l of var_l) {
                        for (const z of var_zero) {
                            const p3 = `zx${s}${o}YbKZXB8jjbsKmAs6o354LYEQW6${i}StK${l}${z}UM`;
                            const token = `${p1}.${p2}.${p3}`;
                            await tryLogin(token);
                        }
                    }
                }
            }
        }
    }
    console.log("Finished all permutations without success.");
    process.exit(1);
}

main();
