// TODO: Migrate from expo-av to expo-audio
// expo-av is deprecated in SDK 54 and will be removed in SDK 55
// See: https://docs.expo.dev/versions/latest/sdk/audio/
// Migration guide: https://docs.expo.dev/versions/latest/sdk/audio/
import { Audio } from 'expo-av';
import { Track } from '../types';

export interface DJPlayerState {
  sound: Audio.Sound | null;
  track: Track | null;
  isPlaying: boolean;
  volume: number;
  position: number;
  duration: number;
}

export class DJAudioService {
  private players: DJPlayerState[] = [];
  private maxPlayers = 4;
  private positionUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize 4 players
    for (let i = 0; i < this.maxPlayers; i++) {
      this.players.push({
        sound: null,
        track: null,
        isPlaying: false,
        volume: 0.5,
        position: 0,
        duration: 0,
      });
    }
  }

  async initialize() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error initializing audio mode:', error);
    }
  }

  async loadTrack(playerIndex: number, track: Track): Promise<boolean> {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) {
      console.error('Invalid player index:', playerIndex);
      return false;
    }

    try {
      // Unload previous track if exists
      await this.unloadTrack(playerIndex);

      const player = this.players[playerIndex];
      
      // Create new sound instance
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.url },
        {
          shouldPlay: false,
          volume: player.volume,
          isLooping: false,
        }
      );

      // Set up status update listener
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          player.position = status.positionMillis || 0;
          player.duration = status.durationMillis || 0;
          player.isPlaying = status.isPlaying || false;

          if (status.didJustFinish) {
            player.isPlaying = false;
            player.position = 0;
          }
        }
      });

      player.sound = sound;
      player.track = track;
      player.position = 0;

      return true;
    } catch (error) {
      console.error(`Error loading track on player ${playerIndex}:`, error);
      return false;
    }
  }

  async unloadTrack(playerIndex: number) {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) return;

    const player = this.players[playerIndex];
    
    if (player.sound) {
      try {
        await player.sound.unloadAsync();
      } catch (error) {
        console.error(`Error unloading track on player ${playerIndex}:`, error);
      }
      player.sound = null;
    }
    
    player.track = null;
    player.isPlaying = false;
    player.position = 0;
    player.duration = 0;
  }

  async play(playerIndex: number) {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) return;

    const player = this.players[playerIndex];
    if (player.sound) {
      try {
        await player.sound.playAsync();
        player.isPlaying = true;
      } catch (error) {
        console.error(`Error playing on player ${playerIndex}:`, error);
      }
    }
  }

  async pause(playerIndex: number) {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) return;

    const player = this.players[playerIndex];
    if (player.sound) {
      try {
        await player.sound.pauseAsync();
        player.isPlaying = false;
      } catch (error) {
        console.error(`Error pausing on player ${playerIndex}:`, error);
      }
    }
  }

  async setVolume(playerIndex: number, volume: number) {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) return;

    const player = this.players[playerIndex];
    player.volume = Math.max(0, Math.min(1, volume));
    
    if (player.sound) {
      try {
        await player.sound.setVolumeAsync(player.volume);
      } catch (error) {
        console.error(`Error setting volume on player ${playerIndex}:`, error);
      }
    }
  }

  async seekTo(playerIndex: number, positionMillis: number) {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) return;

    const player = this.players[playerIndex];
    if (player.sound) {
      try {
        await player.sound.setPositionAsync(positionMillis);
        player.position = positionMillis;
      } catch (error) {
        console.error(`Error seeking on player ${playerIndex}:`, error);
      }
    }
  }

  getPlayerState(playerIndex: number): DJPlayerState | null {
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) return null;
    return { ...this.players[playerIndex] };
  }

  getAllPlayerStates(): DJPlayerState[] {
    return this.players.map(p => ({ ...p }));
  }

  async cleanup() {
    // Stop position updates
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }

    // Unload all tracks
    for (let i = 0; i < this.maxPlayers; i++) {
      await this.unloadTrack(i);
    }
  }
}

// Singleton instance
export const djAudioService = new DJAudioService();
