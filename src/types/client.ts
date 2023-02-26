import { Client, ClientOptions, Collection } from 'discord.js';
import { CommandBase } from './interaction';

export class BackupClient extends Client {
	commands: Collection<string, CommandBase>;

	constructor(options: ClientOptions) {
		super(options);
		this.commands = new Collection<string, CommandBase>();
	}
}
