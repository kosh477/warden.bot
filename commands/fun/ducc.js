module.exports = {
    name: "ducc",
    description: "Summons the holy ducc",
    usage: '',
    args: false,
    permlvl: 0, // 0 = Everyone, 1 = Mentor, 2 = Staff
    hidden: true,
    execute (message) {
        if (message.author.id == "274853598280810496") {
            var c = Math.random() * 100;
            if (c < 50) {
                return message.reply({ content: `Oh no, not you again` });
            }
            else {
                return message.reply({ content: `Shoo... go away...` });
            }
        }
        var c = Math.random() * 100;
        if (c < 50) {
            message.channel.send({ content: `You summoneth the ducc! <@211624816619290624>` });
            message.channel.send({ content: "https://c.tenor.com/N3GVRxPTh-4AAAAM/duck-lmao.gif" });
        }
        else {
            message.channel.send({ content: `Who summons the duck-man?! <@211624816619290624>` });
            message.channel.send({ content: "https://cdn.discordapp.com/attachments/625989888432537611/668012845925138442/duckswag.gif" });
        }
        
    }
}
