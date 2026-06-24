const { Events, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const TicketConfig = require('../models/ticket/ticketConfig');
const discordTranscripts = require('discord-html-transcripts');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    if (interaction.isButton() && interaction.customId === 'create_ticket') {
      try {
     
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const hasActiveTicket = interaction.guild.channels.cache.some(channel => 
          channel.name.includes(interaction.user.username.toLowerCase()) && 
          channel.topic === `Ticket for ${interaction.user.id}`
        );

        if (hasActiveTicket) {
          return interaction.reply({
            content: 'You already have an active ticket! Please close it before opening a new one.',
            ephemeral: true
          });
        }

   
        const modal = new ModalBuilder()
          .setCustomId('ticket_modal')
          .setTitle('Ticket Reason');

        const reasonInput = new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('Why are you opening this ticket?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1000)
          .setPlaceholder('Please describe your issue in detail...');

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error handling create ticket button:', error);
        await interaction.reply({
          content: 'There was an error trying to process your request. Please contact an administrator.',
          ephemeral: true
        });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
        if (!config) {
          return interaction.editReply('Ticket system is not configured for this server. Please contact an administrator.');
        }

        const reason = interaction.fields.getTextInputValue('ticket_reason');
        
        let category = interaction.guild.channels.cache.get(config.categoryId);
        if (!category) {
          category = await interaction.guild.channels.create({
            name: 'Tickets',
            type: ChannelType.GuildCategory
          });
          
          config.categoryId = category.id;
          await config.save();
        }

        let staffRole = interaction.guild.roles.cache.get(config.staffRoleId);

        const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `Ticket for ${interaction.user.id}`,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles
              ],
            },
            ...(staffRole ? [{
              id: staffRole.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageMessages
              ],
            }] : [])
          ],
        });

        const welcomeEmbed = new EmbedBuilder()
          .setTitle('Ticket Opened')
          .setDescription(`Welcome <@${interaction.user.id}>! A staff member will be with you shortly.\n\n**Reason:**\n\`\`\`${reason}\`\`\``)
          .setColor('#00ff00')
          .setTimestamp();

        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒');

        const row = new ActionRowBuilder().addComponents(closeButton);

        const welcomeMessage = await ticketChannel.send({ 
          content: staffRole ? `<@&${staffRole.id}>` : undefined,
          embeds: [welcomeEmbed], 
          components: [row] 
        });

        await welcomeMessage.pin();

        await interaction.editReply(`Ticket created successfully! ${ticketChannel}`);
      } catch (error) {
        console.error('Error creating ticket channel:', error);
        await interaction.editReply('There was an error creating your ticket channel. Please try again later.');
      }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      try {
        const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
        const hasStaffRole = config && interaction.member.roles.cache.has(config.staffRoleId);
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isTicketCreator = interaction.channel.topic === `Ticket for ${interaction.user.id}`;
        
        if (!hasStaffRole && !isAdmin && !isTicketCreator) {
          return interaction.reply({
            content: 'You do not have permission to close this ticket.',
            ephemeral: true
          });
        }

        const confirmEmbed = new EmbedBuilder()
          .setTitle('Close Ticket')
          .setDescription('Are you sure you want to close this ticket? This action cannot be undone and will generate a transcript.')
          .setColor('#ff0000');

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_close_ticket')
            .setLabel('Yes, Close')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_close_ticket')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [confirmEmbed],
          components: [confirmRow]
        });
      } catch (error) {
        console.error('Error showing close confirmation:', error);
        if (!interaction.replied) {
          await interaction.reply({
            content: 'An error occurred.',
            ephemeral: true
          });
        }
      }
    }

    if (interaction.isButton() && interaction.customId === 'cancel_close_ticket') {
      await interaction.message.delete();
    }

    if (interaction.isButton() && interaction.customId === 'confirm_close_ticket') {
      await interaction.reply('Generating transcript and closing ticket...');

      try {
        const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
        const logChannel = config && config.logChannelId ? interaction.guild.channels.cache.get(config.logChannelId) : null;
        
     
        let creatorId = null;
        if (interaction.channel.topic && interaction.channel.topic.includes('Ticket for ')) {
          creatorId = interaction.channel.topic.replace('Ticket for ', '');
        }

        const transcript = await discordTranscripts.createTranscript(interaction.channel, {
          limit: -1,
          returnType: 'buffer',
          filename: `transcript-${interaction.channel.name}.html`,
          saveImages: true,
          poweredBy: false
        });

        const transcriptAttachment = new AttachmentBuilder(transcript, { name: `transcript-${interaction.channel.name}.html` });

     
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .addFields(
              { name: 'Ticket Channel', value: interaction.channel.name, inline: true },
              { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Ticket Creator', value: creatorId ? `<@${creatorId}>` : 'Unknown', inline: true }
            )
            .setColor('#ff0000')
            .setTimestamp();

          await logChannel.send({
            embeds: [logEmbed],
            files: [transcriptAttachment]
          });
        }

   
        if (creatorId) {
          try {
            const creatorUser = await interaction.client.users.fetch(creatorId);
            if (creatorUser) {
              const dmEmbed = new EmbedBuilder()
                .setTitle(`Ticket Closed in ${interaction.guild.name}`)
                .setDescription(`Your ticket (**${interaction.channel.name}**) has been closed by <@${interaction.user.id}>.`)
                .setColor('#0099ff')
                .setTimestamp();
                
              await creatorUser.send({
                embeds: [dmEmbed],
                files: [transcriptAttachment]
              }).catch(() => console.log(`Could not send DM to user ${creatorId}`));
            }
          } catch (dmError) {
            console.error('Error sending DM with transcript:', dmError);
          }
        }

        setTimeout(() => {
          interaction.channel.delete().catch(console.error);
        }, 5000);
      } catch (error) {
        console.error('Error closing ticket:', error);
        await interaction.editReply('There was an error closing the ticket or generating the transcript. Force closing in 5 seconds...');
        setTimeout(() => {
          interaction.channel.delete().catch(console.error);
        }, 5000);
      }
    }
  },
};
