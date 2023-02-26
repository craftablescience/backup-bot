import fs from 'fs';
import { Collection, GuildMember, IntentsBitField, Partials } from 'discord.js';
import { BackupClient } from './types/client';
import { Command } from './types/interaction';
import { updateCommands, updateCommandsForGuild } from './utils/update_commands';
import { isModerator } from './utils/utils';

import * as config from './config.json';

// Make console output better
import consoleStamp from 'console-stamp';
consoleStamp(console);

async function main() {
	// You need a token, duh
	if (!config.token) {
		console.log('Error: no token found in config.json!');
		return;
	}

	const date = new Date();
	console.log(`--- BOT START AT ${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ---`);

	// Create client
	const client = new BackupClient({
		intents: new IntentsBitField([
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMembers,
			IntentsBitField.Flags.GuildMessages,
			IntentsBitField.Flags.MessageContent,
		]),
		partials: [
			Partials.Channel,
			Partials.Message,
			Partials.User,
			Partials.GuildMember,
		]
	});

	// Register commands
	client.commands = new Collection();
	for (const file of fs.readdirSync('./build/commands').filter(file => file.endsWith('.js'))) {
		const command: Command = (await import(`./commands/${file}`)).default;
		client.commands.set(command.data.name, command);
	}

	// Listen for errors
	client.on('error', async error => {
		console.log(`Error: ${error}`);
	});

	// Listen for warnings
	client.on('warn', async warn => {
		console.log(`Warning: ${warn}`);
	});

	client.on('guildCreate', async guild => {
		updateCommandsForGuild(guild.id);
	});

	// Listen for commands
	client.on('interactionCreate', async interaction => {
		if (interaction.isChatInputCommand()) {
			const command = client.commands?.get(interaction.commandName);
			if (!command) return;

			if (!interaction.channel?.isDMBased() && interaction.guild) {
				// Only moderators can run this
				if (!isModerator(interaction.member as GuildMember)) {
					if (interaction.deferred) {
						await interaction.followUp('You do not have permission to execute this command!');
						return;
					} else {
						await interaction.reply({ content: 'You do not have permission to execute this command!', ephemeral: true });
						return;
					}
				}
			}

			console.log(`${interaction.guild?.id}: Command "${interaction.commandName}" ran by ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
			try {
				await command.execute(interaction);
			} catch (err) {
				console.log(`Error: ${(err as Error).toString()}`);
				if (interaction.deferred) {
					await interaction.followUp(`Error executing this command: ${err}`);
				} else {
					await interaction.reply(`Error executing this command: ${err}`);
				}
				return;
			}
		}
	});

	// Log in
	await client.login(config.token);

	process.on('SIGINT', () => {
		const date = new Date();
		console.log(`--- BOT END AT ${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ---`);
		client.destroy();
		process.exit();
	});
}

if (process.argv.includes('--update-commands')) {
	updateCommands();
} else {
	main();
}
