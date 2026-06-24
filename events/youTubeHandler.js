const axios = require('axios');
const xml2js = require('xml2js');
const { notificationsCollection } = require('../mongodb');
const { EmbedBuilder } = require('discord.js');
const cmdIcons = require('../UI/icons/commandicons');

const POLL_INTERVAL = 60000; 

async function fetchYouTubeVideos(client) {
    const configs = await notificationsCollection.find({ type: 'youtube' }).toArray();

    for (const config of configs) {
        const { platformId, discordChannelId, guildId, lastNotifiedId, mentionRoles } = config;

        try {
            const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${platformId}`);
            const parser = new xml2js.Parser();
            
            parser.parseString(response.data, async (err, result) => {
                if (err) {
                    console.error('Error parsing YouTube XML:', err);
                    return;
                }

                if (!result.feed || !result.feed.entry || result.feed.entry.length === 0) {
                    return; 
                }

                const latestVideo = result.feed.entry[0];
                const videoId = latestVideo['yt:videoId'][0];
                const title = latestVideo.title[0];
                const author = latestVideo.author[0].name[0];
                const videoUrl = latestVideo.link[0].$.href;

                if (lastNotifiedId === videoId) return; 

                const channel = client.channels.cache.get(discordChannelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setAuthor({
                            name: `New YouTube Video from ${author}!`,
                            iconURL: cmdIcons.YoutubeIcon,
                            url: videoUrl,
                        })
                        .setTitle(title)
                        .setURL(videoUrl)
                        .setImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
                        .setColor('#FF0000')
                        .setFooter({
                            text: `Make sure to watch and drop a like!`,
                            iconURL: cmdIcons.msgIcon,
                        })
                        .setTimestamp();

                    const mentionText = mentionRoles && mentionRoles.length > 0
                        ? mentionRoles.map(roleId => `<@&${roleId}>`).join(' ')
                        : '';

                    await channel.send({ content: mentionText, embeds: [embed] });

                    await notificationsCollection.updateOne(
                        { guildId, platformId },
                        { $set: { lastNotifiedId: videoId } }
                    );
                }
            });
        } catch (error) {
            //console.error('Error fetching YouTube videos:', error);
        }
    }
}

function startYouTubeNotifications(client) {
    setInterval(() => fetchYouTubeVideos(client), POLL_INTERVAL);
}

module.exports = startYouTubeNotifications;
