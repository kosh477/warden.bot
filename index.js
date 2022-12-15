// Imported Modules
require("dotenv").config();
const { Client, IntentsBitField, EmbedBuilder, Collection } = require("discord.js");
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const cron = require('node-cron');
const fs = require('fs');

// Local Modules
const { leaderboardInteraction } = require('./interaction/submission.js');
const { query } = require("./db");
const config = require('./config.json');

// Discord client setup
const serverIntents = new IntentsBitField(3276799);
const bot = new Client({ intents: serverIntents })

/**
 * Loads command objects from the commands folder
 * @author  (Airom) Airom42
 */
bot.commands = new Collection();
const commandFolders = fs.readdirSync('./commands');
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		command.category = folder;
		if (command.data === undefined) {
			bot.commands.set(command.name, command) // For non-slash commands
		} else {
			bot.commands.set(command.data.name, command) // For slash commands
		}
	}
}

/**
 * Log a discord bot event in the Log Channel
 * @author  (Mgram) Marcus Ingram
 */
async function botLog(embed,severity) {
	let logColor
	switch (severity) {
		case 0:
			logColor = '#42f569'
			break;
		case 1:
			logColor = '#f5bf42'
			break;
		case 2:
			logColor = '#f55142'
			break;
	}
	embed.setColor(logColor)
	.setTimestamp()
	.setFooter({ text: 'Warden Logs', iconURL: config.icon });
	try {
		await bot.channels.cache.get(process.env.LOGCHANNEL).send({ embeds: [embed], })
	} catch {
		console.warn("ERROR: No Log Channel Environment Variable Found, Logging will not work.")
	}
}

/**
 * Deploys Command objects to the Discord API registering any changes
 * @author  (Mgram) Marcus Ingram
 */
async function deployCommands() {
	const commands = [];
	const commandFolders = fs.readdirSync('./commands');
	for (const folder of commandFolders) {
		const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
		for (const file of commandFiles) {
			const command = require(`./commands/${folder}/${file}`);
			command.category = folder;
			if (command.data !== undefined) {
				commands.push(command.data.toJSON());
			}
		}
	}
	const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);
	
	try {
		await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENTID, process.env.GUILDID),
			{ body: commands },
		);

		console.log('✅ Successfully registered application commands');
	} catch (error) {
		console.error(error);
	}
}

/**
 * Event handler for Bot Login, manages post-login setup
 * @author  (Mgram) Marcus Ingram, (Airom42) Airom
 */
bot.once("ready", async() => {
	await deployCommands();
	botLog(new EmbedBuilder().setDescription(`💡 Warden is now online! logged in as ${bot.user.tag}`).setTitle(`Warden Online`),2);
	console.log(`✅ Warden is now online! logged in as ${bot.user.tag}`)
	// Scheduled Role Backup Task
	//cron.schedule('*/5 * * * *', backupRoles('974673947784269824', 'club10'));
})

/**
 * Event handler for Slash Commands, takes interaction to test before executing command code.
 * @author  (Mgram) Marcus Ingram
 */
bot.on('interactionCreate', async interaction => {
	if (interaction.isCommand()) {
		const command = bot.commands.get(interaction.commandName);
		if (!command) {
			console.log('WARNING: Unknown command detected.');
			return;
		}
		let args;
		if (interaction.options !== undefined) {
			try {
				args = JSON.stringify(interaction.options.data)
			} catch (err) {
				console.log(`WARNING: Unable to create arguments for legacy command '${interaction.commandName}', this may not affect modern slash commands: ${err}`)
			}
		}
		try {
			botLog(new EmbedBuilder().setDescription(`Command used by ${interaction.user.tag} - Command ` + "`" + `${interaction.commandName}` + "`" + ` with arguments: ` + "`" + `${args}` + "`"),0);
			await command.execute(interaction, args);
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}

	if (interaction.isButton()) {
		botLog(new EmbedBuilder().setDescription(`Button triggered by user **${interaction.user.tag}** - Button ID: ${interaction.customId}`),0);
		if (interaction.customId.startsWith("submission")) {
			interaction.deferUpdate();
			leaderboardInteraction(interaction);
			return;
		}
		if (interaction.customId === "platformpc") {
			interaction.deferUpdate();
			interaction.member.roles.add("428260067901571073")
			interaction.member.roles.add("380247760668065802")
			botLog(new EmbedBuilder().setDescription(`Welcome Verification passed - User: **${interaction.user.tag}**`),0)
		} else if (interaction.customId === "platformxb") {
			interaction.deferUpdate();
			interaction.member.roles.add("533774176478035991")
			interaction.member.roles.add("380247760668065802")
			botLog(new EmbedBuilder().setDescription(`Welcome Verification passed - User: **${interaction.user.tag}**`),0)
		} else if (interaction.customId === "platformps") {
			interaction.deferUpdate();
			interaction.member.roles.add("428259777206812682")
			interaction.member.roles.add("380247760668065802")
			botLog(new EmbedBuilder().setDescription(`Welcome Verification passed - User: **${interaction.user.tag}**`),0)
		}
		interaction.member.roles.add("642840406580658218");
		interaction.member.roles.add("642839749777948683");
	}
});

// Audit Logging Events

bot.on('messageDelete', async message => {
	try {
		const fetchedLogs = await message.guild.fetchAuditLogs({
			limit: 1,
			type: 'MESSAGE_DELETE',
		});
		// Since there's only 1 audit log entry in this collection, grab the first one
		const deletionLog = fetchedLogs.entries.first();
		// Perform a coherence check to make sure that there's *something*
		if (!deletionLog) {
			botLog(new EmbedBuilder().setDescription(`A message by ${message.author.tag} was deleted, but no relevant audit logs were found.\n\n Message Content:` + "```" + `${message.content}` + "```").setTitle(`Message Deleted`),1);
			return
		}
		// Now grab the user object of the person who deleted the message
		// Also grab the target of this action to double-check things
		const { executor, target } = deletionLog;
		// Update the output with a bit more information
		// Also run a check to make sure that the log returned was for the same author's message
		if (message.id === deletionLog.id) {
			botLog(new EmbedBuilder().setDescription(`A message by ${message.author.tag} was deleted by ${executor.tag}.\n\n Message Content:` + "```" + `${message.content}` + "```").setTitle(`Message Deleted`),1);
		} else {
			botLog(new EmbedBuilder().setDescription(`A message by ${message.author.tag} was deleted, but we don't know by who.\n\n Message Content:` + "```" + `${message.content}` + "```").setTitle(`Message Deleted`),1);
		}
	} catch (err) {
		botLog(new EmbedBuilder().setDescription(`Something went wrong while logging a Deletion event: ${err}`).setTitle(`Logging Error`),2);
	}
})

bot.on('messageUpdate', (oldMessage, newMessage) => {
	if (oldMessage != newMessage) {
		botLog(new EmbedBuilder()
		.setDescription(`Message by ${oldMessage.author.tag} was edited.`)
		.setTitle(`Message Updated`)
		.setURL(oldMessage.url)
		.addFields(
			{ name: `Old Message`, value: `${oldMessage}`},
			{ name: `New Message`, value: `${newMessage}`},
		),1)
	}
});

bot.on('guildMemberRemove', member => {
	let roles = ``
	member.roles.cache.each(role => roles += `${role}\n`)
	botLog(new EmbedBuilder()
	.setDescription(`User ${member.user.tag}(${member.displayName}) has left or was kicked from the server.`)
	.setTitle(`User Left/Kicked from Server`)
	.addFields(
		{ name: `ID`, value: `${member.id}`},
		{ name: `Date Joined`, value: `<t:${(member.joinedTimestamp/1000) >> 0}:F>`},
		{ name: `Roles`, value: `${roles}`},
	))
})

/**
 * Role backup system, takes the targetted role and table and backs up to SQL database.
 * @author  (Mgram) Marcus Ingram
 */
async function backupRoles(roleId, table) {
	console.log(`Starting Role Backup Job (${table})`)
	let guilds = bot.guilds.cache.map((guild) => guild);
	let guild = guilds[0]
	await guild.members.fetch()
	let members = guild.roles.cache.get(roleId).members.map(m=>m.user)
	try {
		await query(`DROP TABLE ${table}`)
	} catch (err) {
		console.log(`Backup Roles: Unable to delete table: ${err}`)
	}
	try {
		await query(`CREATE TABLE ${table}(
			id              SERIAL PRIMARY KEY,
			user_id         text,
			name            text,
			avatar          text
		);`)
	} catch (err) {
		console.log(`Backup Roles: Unable to reset table, exiting task: ${err}`)
		return;
	}
	for (let member of members) {
		let name = await guild.members.cache.get(member.id).nickname
		await query(`INSERT INTO ${table}(user_id, name, avatar) VALUES($1,$2,$3)`, [
			member.id,
			name,
			member.avatar
		])
	}
}

//the following part handles the triggering of reminders
let minutes = 0.1, the_interval = minutes * 60 * 1000; //this sets at what interval are the reminder due times getting checked
setInterval(async function() {
	let currentDate = new Date(Date.now());

	let res = await query("SELECT * FROM reminders WHERE duetime < $1", [currentDate]);

	if (res.rowCount == 0) return; //if there are no due reminders, exit the function

	for (let row = 0; row < res.rowCount; row++) { //send all
		const channel = await bot.channels.cache.get(res.rows[row].channelid);
		channel.send(`<@${res.rows[row].discid}>: ${res.rows[row].memo}`);
	}	

	try {
		res = await query("DELETE FROM reminders WHERE duetime < $1", [currentDate]);
	} catch (err) {
		console.log(err);
	}
}, the_interval);

bot.on("error", () => { bot.login(process.env.TOKEN) });
bot.login(process.env.TOKEN)