import fs from 'fs-extra';
import { CommandInteraction, NewsChannel, SlashCommandBuilder, StageChannel, TextChannel } from 'discord.js';
import { Command } from '../types/interaction';
import fetch from 'node-fetch';
import { formatDate } from '../utils/utils';

interface MessageData {
	date: number,
	date_string: string,
	sender_id: string,
	sender_name: string,
	contents: string,
	contents_clean: string,
	attachments: string[],
}

interface ChannelData {
	[channel: string]: {
		name: string,
		parent_id: string | undefined,
		parent_name: string | undefined,
		messages: string[],
	},
}

interface RoleData {
	name: string,
	color: string,
}

interface MemberData {
	[member: string]: {
		name: string,
		roles: RoleData[],
	},
}

const Backup: Command = {
	data: new SlashCommandBuilder()
		.setName('backup')
		.setDescription('Downloads a backup of the entire server to wherever the bot is installed.')
		.addBooleanOption(option => option
			.setName('download-attachments')
			.setDescription('Downloads message attachments. Bloats guild downloads tremendously. Default = true'))
		.addBooleanOption(option => option
			.setName('only-members')
			.setDescription('Only backup member data. Default = false'))
		.addBooleanOption(option => option
			.setName('only-site')
			.setDescription('Only builds the viewer site based on older data. Default = false')),

	async execute(interaction: CommandInteraction) {
		if (!interaction.isChatInputCommand()) return;
		if (!interaction.inGuild() || !interaction.guild) {
			return interaction.reply({ content: 'This command must be ran in a guild.', ephemeral: true });
		}

		const guild = await interaction.guild.fetch();
		const channel = await interaction.channel?.fetch();

		const downloadAttachments = interaction.options.getBoolean('download-attachments') ?? true;
		const onlyMembers = interaction.options.getBoolean('only-members') ?? false;
		const onlyBuildSite = interaction.options.getBoolean('only-site') ?? false;

		const toJSONBuffer = (object: unknown) => Buffer.from(JSON.stringify(object, null, 2), 'utf-8');
		const writeFile = (path: string, data: Buffer) => {
			fs.outputFile(`./guild_${guild.id}/${path}`, data, err => {
				if (err) {
					console.log(`Unable to write to "${path}"!`);
				}
			});
		};

		const backupChannels = async () => {
			const channels: ChannelData = {};
			for (const [channel, rawchanneldata] of await guild.channels.fetch()) {
				if (!rawchanneldata) {
					console.log(`Channel ${channel} had null data...`);
					continue;
				}
		
				const channeldata = await rawchanneldata.fetch();
				if (!(channeldata instanceof TextChannel) && !(channeldata instanceof NewsChannel)) {
					continue;
				}
				console.log(`Backing up ${guild.name} > #${channeldata.name} (${guild.id}/${channel}) ...`);
		
				channels[channel] = {
					name: channeldata.name,
					parent_id: channeldata.parent?.id,
					parent_name: channeldata.parent?.name,
					messages: [],
				};
		
				let message = await channeldata.messages
					.fetch({ limit: 1 })
					.then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));
				while (message) {
					const messagePage = await channeldata.messages.fetch({ limit: 100, before: message.id });
					for (const [, msg] of messagePage) {
						channels[channel].messages.push(msg.id);
						const messageData: MessageData = {
							date: msg.createdTimestamp,
							date_string: msg.createdAt.toUTCString(),
							sender_id: msg.author.id,
							sender_name: msg.author.username,
							contents: msg.content,
							contents_clean: msg.cleanContent,
							attachments: downloadAttachments ? [] : msg.attachments.mapValues(attachment => attachment.url).toJSON(),
						};
						if (downloadAttachments) {
							for (const [, attachment] of msg.attachments) {
								const attachmentName = attachment.name ?? attachment.url.replace('/', '_').replace(':', '_');
								const attachmentFileName = `messages/${msg.id}/attachments/${attachmentName}`;
								writeFile(attachmentFileName, Buffer.from(await (await fetch(attachment.url)).arrayBuffer()));
								messageData.attachments.push(attachmentName);
							}
						}
						writeFile(`messages/${msg.id}/message.json`, toJSONBuffer(messageData));
					}
					message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
				}
			}
			writeFile('channels.json', toJSONBuffer(channels));
		};

		const backupMembers = async () => {
			const members: MemberData = {};
			for (const [member, memberdata] of await guild.members.fetch()) {
				members[member] = {
					name: memberdata.user.username,
					roles: memberdata.roles.cache.filter(role => role.name !== '@everyone').map<RoleData>(role => {
						return {
							name: role.name,
							color: role.hexColor,
						};
					}),
				};
				const avatarFileName = `members/${member}/avatar.webp`;
				writeFile(avatarFileName, Buffer.from(await (await fetch(memberdata.displayAvatarURL())).arrayBuffer()));
			}
			writeFile('members.json', toJSONBuffer(members));
		};

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const backupSite = () => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const channels: ChannelData = require(`../../guild_${guild.id}/channels.json`);
			let messages = '';
			for (const channelID of Object.keys(channels)) {
				for (const messageID of channels[channelID].messages) {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const message: MessageData = require(`../../guild_${guild.id}/messages/${messageID}/message.json`);
					let attachments = '';
					for (const attachment of message.attachments) {
						if (attachment.endsWith('png') || attachment.endsWith('jpg') || attachment.endsWith('jpeg') || attachment.endsWith('webp')) {
							attachments = `
								<img src="${attachment.startsWith('http://') || attachment.startsWith('https://') ? attachment : `messages/${messageID}/attachments/${attachment}`}" class="attachment attachment-image" />
							` + attachments;
						} else if (attachment.endsWith('mp3') || attachment.endsWith('ogg') || attachment.endsWith('wav')) {
							attachments = `
								<audio src="${attachment.startsWith('http://') || attachment.startsWith('https://') ? attachment : `messages/${messageID}/attachments/${attachment}`}" controls class="attachment attachment-audio" />
							` + attachments;
						} else if (attachment.endsWith('mp4') || attachment.endsWith('webm')) {
							attachments = `
								<video src="${attachment.startsWith('http://') || attachment.startsWith('https://') ? attachment : `messages/${messageID}/attachments/${attachment}`}" controls class="attachment attachment-video" />
							` + attachments;
						}
					}
					messages = `
						<div id="${messageID}" class="author-${message.sender_id} message">
							<img src="members/${message.sender_id}/avatar.webp" class="avatar" onerror="this.onerror=null;this.src='default_avatar.png';" />
							<div>
								<p class="author">${message.sender_name} \u2022 ${message.date_string}</p>
								<p class="content">${message.contents_clean}</p>
								${attachments}
							</div>
						</div>
					` + messages;
				}
				break;
			}

			const html = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<title>${guild.name}</title>
					<style>
						@import url('https://fonts.googleapis.com/css2?family=Noto+Sans&display=swap');
						body {
							background-color: #313338;
							color: white;
							font-family: "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
							font-size: 14px;
							margin: 24px;
							padding: 0;
							display: grid;
							grid-template: auto / 20% auto;
						}
						h1,
						h2,
						p {
							margin: 0;
							padding: 0;
						}
						.active {
							background-color: #505050;
						}
						.message {
							display: flex;
							flex-direction: row;
							flex-wrap: nowrap;
							margin-bottom: 8px;
						}
						.message .content {
							max-width: 75%;
						}
						.message > :first-child {
							border-radius: 50%;
							width: 48px;
							height: 48px;
							margin-right: 8px;
						}
						.attachment {
							max-width: 700px;
							max-height: 500px;
						}
					</style>
				</head>
				<body>
					<nav id="channel-list"></nav>
					<div id="channel-contents">${messages}</div>
				</body>
			</html>
			`;
			writeFile('index.html', Buffer.from(html));
		};

		await interaction.reply('Backup process initiated. Please check console to view progress.');

		if (!onlyMembers && !onlyBuildSite) {
			backupChannels();
		}

		if (!onlyBuildSite) {
			backupMembers();
		}

		//backupSite();

		if (channel && channel.isTextBased() && !(channel instanceof StageChannel)) {
			channel.send(`Backup complete! A copy of the guild at <t:${formatDate(new Date())}:f> has been created.`);
		}
		console.log(`Backup of ${guild.name} (${guild.id}) complete!`);
	},
};
export default Backup;
