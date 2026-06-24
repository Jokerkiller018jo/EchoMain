const VoiceChannel = require('../models/voiceChannel/voiceChannel'); 

module.exports = (client) => {
    client.on('voiceStateUpdate', async (oldState, newState) => {
       
        try {
            const oldChannelId = oldState.channelId;
            const newChannelId = newState.channelId;

           
            if (!oldChannelId && newChannelId) {
                
                await handleJoin(newState);
            } 
           
            else if (oldChannelId && !newChannelId) {
               
                await handleLeave(oldState);
            }
          
            else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
               
                await handleLeave(oldState);
                await handleJoin(newState);
            }
        } catch (error) {
            console.error('Error handling voice channel update:', error);
        }
    });
};

async function handleJoin(newState) {
    const channelId = newState.channelId;

 
    if (newState.channel.type === 13) return;

   
    const voiceChannel = await VoiceChannel.findOne({ channelId });
    if (!voiceChannel) return;

 
    if (newState.channel.members.size === 1) {
       
        if (voiceChannel.originalName === null || voiceChannel.originalName === undefined) {
            voiceChannel.originalName = newState.channel.name;
        }

       
        const member = newState.member;
        const newName = `${member.user.username}'s Room`;
        
       
        try {
            await newState.channel.setName(newName);
            
           
            voiceChannel.customName = newName;
            await voiceChannel.save();
        } catch (error) {
            console.error('Failed to set channel name:', error);
        }
    }
}

async function handleLeave(oldState) {
    const channelId = oldState.channelId;

 
    if (oldState.channel.type === 13) return;

    
    const voiceChannel = await VoiceChannel.findOne({ channelId });
    if (!voiceChannel) return;

    
    if (oldState.channel.members.size === 0) {
        
        const resetName = voiceChannel.originalName || "Waiting Room"; 
        
      
        try {
            await oldState.channel.setName(resetName);
            
         
            voiceChannel.customName = null;
            await voiceChannel.save();
        } catch (error) {
            console.error('Failed to reset channel name:', error);
        }
    }
}
