import { CommandInteraction, InteractionResponse, Message, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface CommandBase {
	data: unknown,
	execute(interaction: CommandInteraction): Promise<void | InteractionResponse<boolean> | Message<boolean>>,
}

export interface Command extends CommandBase {
	data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandSubcommandsOnlyBuilder,
}
