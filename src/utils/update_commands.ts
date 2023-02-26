import fs from 'fs-extra';
import { Client, IntentsBitField } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import * as config from '../config.json';

export async function updateCommands() {
	// You need a token, duh
	if (!config.token) {
		console.log('Error updating commands: no token found in config.json!');
		return;
	}

	const dateStart = new Date();
	console.log(`--- UPDATE COMMANDS FOR ALL GUILDS START AT ${dateStart.toDateString()} ${dateStart.getHours()}:${dateStart.getMinutes()}:${dateStart.getSeconds()} ---`);

	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
		],
	});
	await client.login(config.token);

	const guildCommands = [];
	for (const file of fs.readdirSync('./build/commands').filter(file => file.endsWith('.js'))) {
		guildCommands.push((await import(`../commands/${file}`)).default);
	}

	// Update commands for every guild
	const rest = new REST({ version: '10' }).setToken(config.token);
	for (const guild of (await client.guilds.fetch()).values()) {
		const commands = guildCommands.map(cmd => cmd.data.toJSON());
		await rest.put(Routes.applicationGuildCommands(config.client_id, guild.id), { body: commands });
		console.log(`Registered ${commands.length} guild commands for ${guild.id}`);
	}

	const dateEnd = new Date();
	console.log(`--- UPDATE COMMANDS FOR ALL GUILDS END AT ${dateEnd.toDateString()} ${dateEnd.getHours()}:${dateEnd.getMinutes()}:${dateEnd.getSeconds()} ---`);
	client.destroy();
}

export async function updateCommandsForGuild(guildID: string) {
	const guildCommands = [];
	for (const file of fs.readdirSync('./build/commands').filter(file => file.endsWith('.js'))) {
		guildCommands.push((await import(`../commands/${file}`)).default);
	}

	const commands = guildCommands.map(cmd => cmd.data.toJSON());

	// Update commands for this guild
	const rest = new REST({ version: '10' }).setToken(config.token);
	await rest.put(Routes.applicationGuildCommands(config.client_id, guildID), { body: commands });
	console.log(`Registered ${commands.length} guild commands for ${guildID}`);
}
