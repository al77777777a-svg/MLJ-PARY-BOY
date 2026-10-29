// ╔══════════════════════════════════════════════════════════╗
// ║   بوت مواقيت الصلاة والأذكار - Prayer & Adhkar Bot       ║
// ║   تنبيهات إسلامية تلقائية بتوقيت الإمارات 🇦🇪            ║
// ╚══════════════════════════════════════════════════════════╝

require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    AttachmentBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    Events,
    MessageFlags,
} = require('discord.js');
const cron = require('node-cron');
const path = require('path');
const fs   = require('fs');
const { postPrayerAdhkar, morningAdhkar, eveningAdhkar } = require('./adhkar');

// ─── Configuration ─────────────────────────────────────────
const TOKEN           = process.env.DISCORD_TOKEN;
const CHANNEL_ID      = process.env.CHANNEL_ID;
const TEST_CHANNEL_ID = process.env.TEST_CHANNEL_ID || '1541137270600507422';
const CITY            = process.env.CITY || 'Abu Dhabi';
const COUNTRY         = process.env.COUNTRY || 'AE';
const METHOD          = process.env.CALCULATION_METHOD || '16';
const GIF_URL         = process.env.GIF_URL || '';
const SERVER_ICON     = process.env.SERVER_ICON || 'https://cdn.discordapp.com/icons/1318136315530973204/a_4061957f80d830da88908f431bc9bb0d.webp?animated=true&size=1024';
const MENTION         = process.env.MENTION || '@everyone';

if (!TOKEN || !CHANNEL_ID) {
    console.error('❌ يرجى تعبئة DISCORD_TOKEN و CHANNEL_ID في ملف .env');
    process.exit(1);
}

// ─── Prayer definitions ────────────────────────────────────
const PRAYERS = {
    Fajr:    { ar: 'الفجر',   emoji: '🌅' },
    Dhuhr:   { ar: 'الظهر',   emoji: '☀️'  },
    Asr:     { ar: 'العصر',   emoji: '🌤️'  },
    Maghrib: { ar: 'المغرب',  emoji: '🌇' },
    Isha:    { ar: 'العشاء',  emoji: '🌙' },
};
const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// ─── State ─────────────────────────────────────────────────
let currentTimings     = {};
let notifiedToday      = new Set();
let preNotifiedToday   = new Set();

// ─── Discord Client ────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
    allowedMentions: {
        parse: ['everyone', 'roles', 'users'],
    },
});

// ─── UAE Time Helpers ──────────────────────────────────────
function getUAETime() {
    return new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })
    );
}

function formatHHMM(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function subtractMinutes(timeStr, mins) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    let totalMins = h * 60 + m - mins;
    if (totalMins < 0) totalMins += 24 * 60;
    const newH = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
    const newM = String(totalMins % 60).padStart(2, '0');
    return `${newH}:${newM}`;
}

// ─── Fetch Prayer Times from Aladhan API ───────────────────
async function fetchPrayerTimes() {
    const url =
        `https://api.aladhan.com/v1/timingsByCity` +
        `?city=${encodeURIComponent(CITY)}` +
        `&country=${encodeURIComponent(COUNTRY)}` +
        `&method=${METHOD}`;

    console.log(`📡 جلب مواقيت الصلاة: ${url}`);

    const res  = await fetch(url);
    const data = await res.json();

    if (data.code !== 200) {
        throw new Error(`API error: ${JSON.stringify(data)}`);
    }

    const timings = {};
    for (const p of PRAYER_ORDER) {
        timings[p] = data.data.timings[p].split(' ')[0];
    }

    currentTimings = timings;
    console.log('🕌 مواقيت اليوم:', currentTimings);
    return timings;
}

// ─── Prayer Helpers ────────────────────────────────────────
function getCurrentPrayer() {
    const hhmm = formatHHMM(getUAETime());
    let current = 'Isha';
    for (let i = PRAYER_ORDER.length - 1; i >= 0; i--) {
        const p = PRAYER_ORDER[i];
        if (hhmm >= currentTimings[p]) {
            current = p;
            break;
        }
    }
    return current;
}

function getNextPrayer(currentKey) {
    const idx = PRAYER_ORDER.indexOf(currentKey);
    return PRAYER_ORDER[(idx + 1) % PRAYER_ORDER.length];
}

function getNextPrayerInfo() {
    const now = getUAETime();
    const hhmm = formatHHMM(now);
    let nextKey = null;

    for (const p of PRAYER_ORDER) {
        if (currentTimings[p] > hhmm) {
            nextKey = p;
            break;
        }
    }

    let isTomorrow = false;
    if (!nextKey) {
        nextKey = 'Fajr';
        isTomorrow = true;
    }

    const [targetH, targetM] = currentTimings[nextKey].split(':').map(Number);
    const targetDate = new Date(now);
    if (isTomorrow) {
        targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(targetH, targetM, 0, 0);

    const diffMs = targetDate.getTime() - now.getTime();
    const diffTotalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(diffTotalMinutes / 60);
    const minutes = diffTotalMinutes % 60;

    let remainingText = '';
    if (hours > 0 && minutes > 0) {
        remainingText = `${hours} ساعة و ${minutes} دقيقة`;
    } else if (hours > 0 && minutes === 0) {
        remainingText = `${hours} ساعة`;
    } else if (hours === 0 && minutes > 0) {
        remainingText = `${minutes} دقيقة`;
    } else {
        remainingText = 'أقل من دقيقة';
    }

    const unixSec = Math.floor(targetDate.getTime() / 1000);

    return {
        key: nextKey,
        info: PRAYERS[nextKey],
        time: currentTimings[nextKey],
        hours,
        minutes,
        remainingText,
        unixSec,
        isTomorrow,
    };
}

async function resolveChannel(targetChannel) {
    if (typeof targetChannel === 'object' && targetChannel.id) {
        return targetChannel;
    }
    try {
        return await client.channels.fetch(targetChannel);
    } catch (err) {
        console.error(`❌ ما قدرت أوصل للقناة ${targetChannel}:`, err.message);
        return null;
    }
}

// ─── 1) تنبيه ما قبل الأذان بـ 10 دقائق (بدون منشن) ──────────
async function sendPrePrayerReminder(prayerKey, targetChannel = CHANNEL_ID) {
    const channel = await resolveChannel(targetChannel);
    if (!channel) return;

    const prayer = PRAYERS[prayerKey];
    const curTime = currentTimings[prayerKey];

    const embed = new EmbedBuilder()
        .setTitle(`⏳ اقترب موعد صلاة ${prayer.ar} ${prayer.emoji}`)
        .setDescription(`باقي **10 دقائق** على أذان **صلاة ${prayer.ar}** (🇦🇪 ${curTime})`)
        .setColor(0xE67E22)
        .setTimestamp();

    // بدون منشن
    await channel.send({ embeds: [embed] });
    console.log(`⏳ تم إرسال تذكير ما قبل أذان ${prayer.ar} (بدون منشن)`);
}

// ─── 2) تنبيه الأذان وقت الصلاة (مع المنشن الوحيد) ───────────
async function sendPrayerNotification(prayerKey, targetChannel = CHANNEL_ID) {
    const channel = await resolveChannel(targetChannel);
    if (!channel) return;

    const prayer     = PRAYERS[prayerKey];
    const nextKey    = getNextPrayer(prayerKey);
    const nextPrayer = PRAYERS[nextKey];
    const curTime    = currentTimings[prayerKey];
    const nxtTime    = currentTimings[nextKey];

    const files = [];
    const adhanPath = path.join(__dirname, 'adhan.mp3');
    if (fs.existsSync(adhanPath)) {
        files.push(new AttachmentBuilder(adhanPath, { name: 'adhan.mp3' }));
    }

    let serverIcon = SERVER_ICON || channel.guild?.iconURL({ size: 1024, dynamic: true });
    if (serverIcon && (serverIcon.endsWith('?') || serverIcon.includes('true&size') || !serverIcon.startsWith('http'))) {
        serverIcon = channel.guild?.iconURL({ size: 1024, dynamic: true });
    }

    const embed = new EmbedBuilder()
        .setTitle(`حان الآن موعد صلاة ${prayer.ar}`)
        .addFields(
            {
                name: `الصلاة القادمة (${nextPrayer.ar})`,
                value: `🇦🇪 ${nxtTime}`,
                inline: true,
            },
            {
                name: `الصلاة الحالية (${prayer.ar})`,
                value: `🇦🇪 ${curTime}`,
                inline: true,
            }
        )
        .setColor(0x5D4037);

    if (serverIcon) {
        try {
            embed.setThumbnail(serverIcon);
        } catch (e) {}
    }

    if (GIF_URL && GIF_URL.startsWith('http')) {
        try {
            embed.setImage(GIF_URL);
        } catch (e) {}
    }

    // إرسال تنبيه الأذان (المنشن الوحيد)
    await channel.send({
        content: MENTION,
        embeds: [embed],
        files,
        allowedMentions: { parse: ['everyone', 'roles', 'users'] },
    });

    console.log(`✅ تم إرسال تنبيه ${prayer.ar} (${prayerKey}) — ${curTime} مع المنشن`);

    // جدولة أذكار ما بعد الصلاة تلقائياً بعد 25 دقيقة من الأذان (بعد الإقامة وانقضاء الصلاة في المسجد)
    setTimeout(async () => {
        try {
            await sendPostPrayerAdhkar(prayerKey, channel);
        } catch (err) {
            console.error('❌ خطأ في إرسال أذكار ما بعد الصلاة:', err.message);
        }
    }, 25 * 60 * 1000);

    // إذا كانت صلاة الفجر: إرسال أذكار الصباح بعد الصلاة بـ 27 دقيقة (بدون منشن)
    if (prayerKey === 'Fajr') {
        setTimeout(async () => {
            try {
                await sendMorningAdhkar(channel);
            } catch (err) {
                console.error('❌ خطأ في إرسال أذكار الصباح:', err.message);
            }
        }, 27 * 60 * 1000);
    }

    // إذا كانت صلاة العصر: إرسال أذكار المساء بعد الصلاة بـ 27 دقيقة (بدون منشن)
    if (prayerKey === 'Asr') {
        setTimeout(async () => {
            try {
                await sendEveningAdhkar(channel);
            } catch (err) {
                console.error('❌ خطأ في إرسال أذكار المساء:', err.message);
            }
        }, 27 * 60 * 1000);
    }
}

// ─── 3) أذكار ما بعد الصلاة (بدون منشن) ──────────────────────
async function sendPostPrayerAdhkar(prayerKey, targetChannel = CHANNEL_ID) {
    const channel = await resolveChannel(targetChannel);
    if (!channel) return;

    const prayer = PRAYERS[prayerKey];
    const embed = new EmbedBuilder()
        .setTitle(`📿 ${postPrayerAdhkar.title} (${prayer.ar})`)
        .setDescription(postPrayerAdhkar.items.join('\n\n'))
        .setColor(0x2E7D32)
        .setFooter({ text: 'تقبل الله منا ومنكم صالح الأعمال 🤲' })
        .setTimestamp();

    // بدون منشن
    await channel.send({ embeds: [embed] });
    console.log(`📿 تم إرسال أذكار ما بعد صلاة ${prayer.ar} (بدون منشن)`);
}

// ─── 4) أذكار الصباح (بدون منشن) ─────────────────────────────
async function sendMorningAdhkar(targetChannel = CHANNEL_ID) {
    const channel = await resolveChannel(targetChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(morningAdhkar.title)
        .setDescription(morningAdhkar.items.join('\n\n'))
        .setColor(0xF39C12)
        .setFooter({ text: 'حصن المسلم 🌿 أذكار الصباح' })
        .setTimestamp();

    // بدون منشن
    await channel.send({ embeds: [embed] });
    console.log('🌅 تم إرسال أذكار الصباح (بدون منشن)');
}

// ─── 5) أذكار المساء (بدون منشن) ─────────────────────────────
async function sendEveningAdhkar(targetChannel = CHANNEL_ID) {
    const channel = await resolveChannel(targetChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(eveningAdhkar.title)
        .setDescription(eveningAdhkar.items.join('\n\n'))
        .setColor(0x8E44AD)
        .setFooter({ text: 'حصن المسلم 🌙 أذكار المساء' })
        .setTimestamp();

    // بدون منشن
    await channel.send({ embeds: [embed] });
    console.log('🌇 تم إرسال أذكار المساء (بدون منشن)');
}

// ─── Register Slash Commands ───────────────────────────────
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('prayertimes')
            .setDescription('🕌 عرض مواقيت الصلاة لليوم'),
        new SlashCommandBuilder()
            .setName('nextprayer')
            .setDescription('⏳ عرض الصلاة القادمة مع العداد التنازلي'),
        new SlashCommandBuilder()
            .setName('testadhan')
            .setDescription('🔔 إرسال تنبيه تجريبي للأذان'),
        new SlashCommandBuilder()
            .setName('azkar')
            .setDescription('📿 قراءة أذكار ما بعد الصلاة'),
        new SlashCommandBuilder()
            .setName('sabah')
            .setDescription('🌅 قراءة أذكار الصباح'),
        new SlashCommandBuilder()
            .setName('masa')
            .setDescription('🌇 قراءة أذكار المساء'),
    ].map(c => c.toJSON());

    const rest = new REST().setToken(TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('✅ تم تسجيل الأوامر (Slash Commands)');
    } catch (err) {
        console.error('❌ خطأ في تسجيل الأوامر:', err);
    }
}

// ─── Bot Ready Event ───────────────────────────────────────
client.once(Events.ClientReady, async () => {
    console.log(`\n🤖 تم تسجيل الدخول: ${client.user.tag}`);
    console.log(`📢 قناة التنبيهات الرسمية: ${CHANNEL_ID}`);
    console.log(`🧪 قناة التست: ${TEST_CHANNEL_ID}`);
    console.log(`📍 المدينة: ${CITY}, ${COUNTRY} | طريقة الحساب: ${METHOD}\n`);

    await registerCommands();
    await fetchPrayerTimes();

    // تجاهل الصلوات التي انقضى وقتها قبل تشغيل البوت اليوم حتى لا تنزل بأثر رجعي
    const startupHHMM = formatHHMM(getUAETime());
    for (const p of PRAYER_ORDER) {
        if (currentTimings[p] && currentTimings[p] <= startupHHMM) {
            notifiedToday.add(p);
            preNotifiedToday.add(p);
        }
    }

    // المجدول كل دقيقة
    cron.schedule('* * * * *', async () => {
        const hhmm = formatHHMM(getUAETime());

        for (const p of PRAYER_ORDER) {
            const prayerTime = currentTimings[p];
            if (!prayerTime) continue;

            // أ) تنبيه قبل الأذان بـ 10 دقائق (بدون منشن)
            const preTime = subtractMinutes(prayerTime, 10);
            if (hhmm >= preTime && hhmm < prayerTime && !preNotifiedToday.has(p)) {
                preNotifiedToday.add(p);
                try {
                    await sendPrePrayerReminder(p, CHANNEL_ID);
                } catch (err) {
                    console.error(`❌ خطأ في تذكير ما قبل صلاة ${p}:`, err);
                }
            }

            // ب) تنبيه الأذان وقت الصلاة (مع المنشن الوحيد)
            if (hhmm >= prayerTime && !notifiedToday.has(p)) {
                notifiedToday.add(p);
                try {
                    await sendPrayerNotification(p, CHANNEL_ID);
                } catch (err) {
                    console.error(`❌ خطأ في إرسال تنبيه ${p}:`, err);
                }
            }
        }
    });

    // تحديث المواقيت في منتصف الليل
    cron.schedule('1 0 * * *', async () => {
        console.log('🔄 منتصف الليل — تحديث مواقيت الصلاة لليوم الجديد');
        notifiedToday.clear();
        preNotifiedToday.clear();
        try {
            await fetchPrayerTimes();
        } catch (err) {
            console.error('❌ خطأ في تحديث المواقيت:', err);
        }
    }, { timezone: 'Asia/Dubai' });

    console.log('⏰ المجدول شغّال — التنبيهات والأذكار جاهزة تلقائياً\n');
});

// ─── Slash Commands Handler ────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ── /prayertimes ──
    if (interaction.commandName === 'prayertimes') {
        if (!Object.keys(currentTimings).length) {
            return interaction.reply({
                content: '⏳ لم يتم تحميل المواقيت بعد...',
                flags: MessageFlags.Ephemeral,
            });
        }

        const now  = getUAETime();
        const hhmm = formatHHMM(now);

        let desc = '## 🕌 مواقيت الصلاة لليوم بتوقيت أبوظبي 🇦🇪\n\n';
        for (const p of PRAYER_ORDER) {
            const info = PRAYERS[p];
            const time = currentTimings[p] || '--:--';
            const done = notifiedToday.has(p) || time < hhmm;
            const mark = done ? '✅' : '⬜';
            desc += `${mark} ${info.emoji} **${info.ar}** — 🇦🇪 ${time}\n`;
        }
        desc += `\n📍 ${CITY}, ${COUNTRY}`;

        const embed = new EmbedBuilder()
            .setDescription(desc)
            .setColor(0x1B5E20)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // ── /nextprayer ──
    if (interaction.commandName === 'nextprayer') {
        const next = getNextPrayerInfo();

        const desc = [
            `## ⏭️ الصلاة القادمة: صلاة ${next.info.ar} ${next.info.emoji}`,
            ``,
            `⏳ **المتبقي:** باقي **${next.remainingText}** على صلاة **${next.info.ar}**`,
            `⏰ **موعد الأذان:** 🇦🇪 **${next.time}** (<t:${next.unixSec}:R>)`,
            ``,
            `📍 *${CITY}, دولة الإمارات العربية المتحدة*`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setDescription(desc)
            .setColor(0x1B5E20)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // ── /testadhan ──
    if (interaction.commandName === 'testadhan') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const testPrayer = getCurrentPrayer();

        try {
            const target = interaction.channel || TEST_CHANNEL_ID;
            await sendPrayerNotification(testPrayer, target);
            await interaction.editReply(`✅ تم إرسال تنبيه صلاة ${PRAYERS[testPrayer].ar} مع المنشن وبدء جدولة الأذكار!`);
        } catch (err) {
            await interaction.editReply(`❌ خطأ: ${err.message}`);
        }
    }

    // ── /azkar ──
    if (interaction.commandName === 'azkar') {
        const currentPrayer = getCurrentPrayer();
        const prayer = PRAYERS[currentPrayer];
        const embed = new EmbedBuilder()
            .setTitle(`📿 ${postPrayerAdhkar.title} (${prayer.ar})`)
            .setDescription(postPrayerAdhkar.items.join('\n\n'))
            .setColor(0x2E7D32)
            .setFooter({ text: 'تقبل الله منا ومنكم صالح الأعمال 🤲' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // ── /sabah ──
    if (interaction.commandName === 'sabah') {
        const embed = new EmbedBuilder()
            .setTitle(morningAdhkar.title)
            .setDescription(morningAdhkar.items.join('\n\n'))
            .setColor(0xF39C12)
            .setFooter({ text: 'حصن المسلم 🌿 أذكار الصباح' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // ── /masa ──
    if (interaction.commandName === 'masa') {
        const embed = new EmbedBuilder()
            .setTitle(eveningAdhkar.title)
            .setDescription(eveningAdhkar.items.join('\n\n'))
            .setColor(0x8E44AD)
            .setFooter({ text: 'حصن المسلم 🌙 أذكار المساء' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
});

// ─── Listen for text messages in ANY channel ───────────────
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    // 1) تجربة الأذان: test أو تست
    if (content === 'test' || content === 'تست') {
        const testPrayer = getCurrentPrayer();
        try {
            await sendPrayerNotification(testPrayer, message.channel);
        } catch (err) {
            console.error('❌ خطأ أثناء تنفيذ التيست في الروم:', err.message);
        }
        return;
    }

    // 2) تجربة أذكار بعد الصلاة: azkar أو اذكار
    if (content === 'azkar' || content === 'اذكار' || content === 'أذكار') {
        const testPrayer = getCurrentPrayer();
        try {
            await sendPostPrayerAdhkar(testPrayer, message.channel);
        } catch (err) {
            console.error('❌ خطأ أثناء إرسال الأذكار:', err.message);
        }
        return;
    }

    // 3) تجربة أذكار الصباح: sabah أو صباح
    if (content === 'sabah' || content === 'صباح') {
        try {
            await sendMorningAdhkar(message.channel);
        } catch (err) {
            console.error('❌ خطأ أثناء إرسال أذكار الصباح:', err.message);
        }
        return;
    }

    // 4) تجربة أذكار المساء: masa أو مساء
    if (content === 'masa' || content === 'مساء') {
        try {
            await sendEveningAdhkar(message.channel);
        } catch (err) {
            console.error('❌ خطأ أثناء إرسال أذكار المساء:', err.message);
        }
        return;
    }

    // 5) تجربة تذكير ما قبل الأذان: تذكير أو pre
    if (content === 'تذكير' || content === 'pre') {
        const next = getNextPrayerInfo();
        try {
            await sendPrePrayerReminder(next.key, message.channel);
        } catch (err) {
            console.error('❌ خطأ أثناء إرسال التذكير:', err.message);
        }
        return;
    }
});

// ─── Login ─────────────────────────────────────────────────
client.login(TOKEN);
