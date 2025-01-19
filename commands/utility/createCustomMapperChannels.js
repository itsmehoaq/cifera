const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cm-create')
        .setDescription('Automatically create Custom Mapper channels')
        .addRoleOption(option =>
            option
                .setName('role1')
                .setDescription('Members in this role will be allowed to see these channels')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('role2')
                .setDescription('Members in this role will be allowed to see these channels')
                .setRequired(false)
        ),

    execute: async (interaction) => {
        await interaction.deferReply();
        const members = await interaction.guild.members.fetch(); //load members into cache
        if (!config.admins.includes(interaction.user.id)) {
            return interaction.editReply({
                content: `:x: You are not authorized to use this command.`,
                ephemeral: true,
            });
        }
        if (!interaction.guild.channels.cache.has(config.customMapperCategory)) {
            return interaction.editReply({
                content: `':x: Custom Mapper Category not set/not found.`,
                ephemeral: true,
            })
        }
        const cmCategory = interaction.guild.channels.cache.find(channel => channel.id === config.customMapperCategory)
        if (cmCategory.type !== 4) {
            return interaction.editReply({
                content: `:x: ID provided is not a valid category`,
                ephemeral: true
            })
        }
        if (!interaction.guild.roles.cache.has(config.customMapperRole)) {
            return interaction.editReply({
                content: `:x: Custom Mapper Role not set/not found.`,
                ephemeral: true,
            })
        }
        const cmRole = interaction.guild.roles.cache.find(role => role.id === config.customMapperRole)
        const cmChannels = cmCategory.children.cache.map(c => c.name);
        let customMappers = cmRole.members.map(member => member);
        let allowedRole1 = interaction.options.getRole('role1');
        let allowedRole2 = interaction.options.getRole('role2');
        let everyoneRole = interaction.guild.roles.everyone;
        for (let i = 0; i< customMappers.length; i++) {
            let fullChannel = 'cm-' + customMappers[i].user.username;
            let channelExisted = false;
            for (let j = 0; j < cmChannels.length; j++) { //check if channel exists
                let temp = cmChannels[j].slice(3); //remove cm- in the channel name
                if (customMappers[i].user.username.includes(temp)) {
                    channelExisted = true;
                    break;
                }
            }
            if (channelExisted) {
                continue;
            }
            await interaction.guild.channels.create({
                name: fullChannel,
                parent: cmCategory,
                permissionOverwrites: [
                    {
                        id: customMappers[i].user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages]
                    },
                    {
                        id: everyoneRole.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            }).then(async channel => {
                if (allowedRole1 !== null) {
                    await interaction.guild.channels.edit(channel.id, {
                        permissionOverwrites: [
                            {
                                id: allowedRole1.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages]
                            }
                        ]
                    })
                }
                if (allowedRole2 !== null) {
                    await interaction.guild.channels.edit(channel.id, {
                        permissionOverwrites: [
                            {
                                id: allowedRole2.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages]
                            }
                        ]
                    })
                }
            }).catch(error => {
                console.error(error);
                return interaction.editReply({ content: 'An error occurred.'})
            })
        }
        interaction.editReply({ content: ':white_check_mark: Command completed successfully.'})
    }
}

//will fuck up if these is a special character in the middle of the name