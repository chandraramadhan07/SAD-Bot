const { Client, Intents, MessageEmbed } = require('discord.js');
const { token, prefix } = require('./config.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, VolumeTransformer } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

const queue = new Map();

client.once('ready', () => {
  console.log('Bot sedang online!');
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const serverQueue = queue.get(message.guild.id);

  if (command === 'play') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      message.reply('Anda harus berada di dalam voice channel terlebih dahulu!');
      return;
    }

    if (!args[0]) {
      message.reply('Harap sertakan URL video YouTube!');
      return;
    }

    const playlistRegex = /^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/;
  const url = args[0];

  if (playlistRegex.test(url)) {
    // Jika URL adalah playlist YouTube
    const playlist = await ytpl(url);
    const songs = playlist.items.map(item => {
      return {
        title: item.title,
        url: item.url,
      };
    });

    if (!serverQueue) {
      const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true,
      };

      queue.set(message.guild.id, queueContruct);
      queueContruct.songs = songs;

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        queueContruct.connection = connection;
        play(message.guild, queueContruct.songs[0]);
      } catch (error) {
        console.error('Terjadi kesalahan saat bergabung ke dalam voice channel:', error);
        queue.delete(message.guild.id);
        return message.reply('Terjadi kesalahan saat bergabung ke dalam voice channel!');
      }
    } else {
      serverQueue.songs.push(...songs);
      return message.channel.send(`Daftar putar **${playlist.title}** telah ditambahkan ke dalam antrian!`);
    }
  }
  else {
    // Jika URL adalah lagu YouTube tunggal
    const songInfo = await ytdl.getInfo(url);
    const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
      const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true,
      };

      queue.set(message.guild.id, queueContruct);
      queueContruct.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        queueContruct.connection = connection;
        play(message.guild, queueContruct.songs[0]);
      } catch (error) {
        console.error('Terjadi kesalahan saat bergabung ke dalam voice channel:', error);
        queue.delete(message.guild.id);
        return message.reply('Terjadi kesalahan saat bergabung ke dalam voice channel!');
      }
    } else {
      serverQueue.songs.push(song);
      return message.channel.send(`Lagu **${song.title}** telah ditambahkan ke dalam antrian!`);
    }
  }
}

//command skip n stop
  if (command === 'skip') {
    skip(message);
  } 
  
  else if (command === 'stop') {
    stop(message);
  }

  function skip(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
      return message.reply('Tidak ada lagu yang sedang diputar!');
    }
    if (!message.member.voice.channel) {
      return message.reply('Anda harus berada di dalam voice channel terlebih dahulu!');
    }
    if (!serverQueue.connection) {
      return message.reply('Tidak ada lagu yang sedang diputar!');
    }
  
    serverQueue.songs.shift(); // Menghapus lagu saat ini dari antrian
    message.channel.send('Lagu saat ini telah di-skip!');
  
    // Memeriksa apakah masih ada lagu dalam antrian
    if (serverQueue.songs.length > 0) {
      play(message.guild, serverQueue.songs[0]); // Memutar lagu berikutnya dalam antrian
    }
  }
  
  function stop(message) {
    if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
      audioPlayer.stop();
    }
    if (connection) {
      connection.destroy();
      connection = null;
    }
    message.reply('Berhenti memutar lagu dan keluar dari voice channel.');
  }
  
});

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!serverQueue) return;
  if (!song) {
    serverQueue.textChannel.send('Tidak ada lagu lagi dalam antrian!');
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream);

  // fix
  if (resource.volume) {
  resource.volume.setVolumeLogarithmic(serverQueue.volume / 5);
  }

  const player = createAudioPlayer();
  player.play(resource);

  serverQueue.connection.subscribe(player);
  player.play(resource);

  serverQueue.textChannel.send(`Sedang memutar lagu: **${song.title}**`);

  player.on(AudioPlayerStatus.Idle, () => {
  serverQueue.songs.shift();
  play(guild, serverQueue.songs[0]);
  });

  player.on('error', (error) => {
    console.error('Terjadi kesalahan saat memutar audio:', error);
    serverQueue.textChannel.send('Terjadi kesalahan saat memutar audio.');
    queue.delete(guild.id);
  });
}


client.login(token);