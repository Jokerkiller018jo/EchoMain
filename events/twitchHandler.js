const axios = require('axios');
const { notificationsCollection } = require('../mongodb');
const { EmbedBuilder } = require('discord.js');
const cmdIcons = require('../UI/icons/commandicons');

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const POLL_INTERVAL = 60000; // 1 minute

async function getTwitchAccessToken() {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Twitch access token:', error);
        return null;
    }
}

async function fetchTwitchStreams(client) {
    const accessToken = await getTwitchAccessToken();
    if (!accessToken) return;

    const configs = await notificationsCollection.find({ type: 'twitch' }).toArray();

    for (const config of configs) {
        const { platformId, discordChannelId, guildId, lastNotifiedId, mentionRoles } = config;

        try {
            const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${platformId}`, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const streams = response.data.data;

            if (!streams || streams.length === 0) continue; 

            const stream = streams[0];
            const streamId = stream.id;

            if (lastNotifiedId === streamId) continue; 

            const channel = client.channels.cache.get(discordChannelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: `${stream.user_name} is now live on Twitch!`,
                        iconURL: cmdIcons.TwitchIcon,
                        url: `https://www.twitch.tv/${platformId}`,
                    })
                    .setTitle(stream.title)
                    .setURL(`https://www.twitch.tv/${platformId}`)
                    .setDescription(`Playing: ${stream.game_name}\nViewers: ${stream.viewer_count}`)
                    .setImage(stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'))
                    .setColor('#6441a5')
                    .setTimestamp();

                const mentionText = mentionRoles && mentionRoles.length > 0
                    ? mentionRoles.map(roleId => `<@&${roleId}>`).join(' ')
                    : '';

                await channel.send({ content: mentionText, embeds: [embed] });

                await notificationsCollection.updateOne(
                    { guildId, platformId },
                    { $set: { lastNotifiedId: streamId } }
                );
            }
        } catch (error) {
            //console.error('Error fetching Twitch streams:', error);
        }
    }
}

function startTwitchNotifications(client) {
    setInterval(() => fetchTwitchStreams(client), POLL_INTERVAL);
}

module.exports = startTwitchNotifications;
