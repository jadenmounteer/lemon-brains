import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private music: HTMLAudioElement;
  private zombieSound: HTMLAudioElement;
  private quenchedSound: HTMLAudioElement;
  private isMusicPlaying = false;
  private zombieSoundInterval?: ReturnType<typeof setInterval>;
  private isMuted = false;

  constructor() {
    this.music = new Audio();
    this.music.src = 'assets/audio/soundtrack.m4a';
    this.music.loop = true;
    this.music.volume = 0.4;
    this.zombieSound = new Audio();
    this.zombieSound.src = 'assets/audio/zombie sound.m4a';
    this.zombieSound.volume = 0.2; // Slightly lower volume for sound effect

    this.quenchedSound = new Audio('assets/audio/quenched.m4a');
    this.quenchedSound.volume = 0.4;
  }

  play() {
    if (!this.isMusicPlaying) {
      this.music.play().catch((error) => {
        console.warn('Audio playback failed:', error);
      });
      this.isMusicPlaying = true;
      this.startRandomZombieSounds();
    }
  }

  pause() {
    if (this.isMusicPlaying) {
      this.music.pause();
      this.isMusicPlaying = false;
      this.stopRandomZombieSounds();
    }
  }

  toggle() {
    if (this.isMusicPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isMusicPlaying;
  }

  setVolume(volume: number) {
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    this.music.volume = normalizedVolume;
    this.zombieSound.volume = normalizedVolume * 0.7; // Keep zombie sound slightly quieter
  }

  private startRandomZombieSounds() {
    // Clear any existing interval
    if (this.zombieSoundInterval) {
      clearInterval(this.zombieSoundInterval);
    }

    // Play zombie sounds at random intervals between 5 and 15 seconds
    this.zombieSoundInterval = setInterval(() => {
      if (this.isMusicPlaying) {
        this.playZombieSound();
      }
    }, Math.random() * 10000 + 30000); // Random interval
  }

  playZombieSound() {
    // Create a new Audio instance each time to allow overlapping sounds
    const zombieSound = new Audio('assets/audio/zombie sound.m4a');
    zombieSound.volume = this.zombieSound.volume;
    zombieSound.play().catch((error) => {
      console.warn('Zombie sound playback failed:', error);
    });
  }

  private stopRandomZombieSounds() {
    if (this.zombieSoundInterval) {
      clearInterval(this.zombieSoundInterval);
      this.zombieSoundInterval = undefined;
    }
  }

  playQuenchedSound() {
    if (!this.isMuted) {
      this.quenchedSound.currentTime = 0;
      this.quenchedSound.play();
    }
  }

  // Clean up method to be called when the game is destroyed
  cleanup() {
    this.pause();
    this.stopRandomZombieSounds();
    this.music.pause();
    this.music.currentTime = 0;
    this.zombieSound.pause();
    this.zombieSound.currentTime = 0;
    this.quenchedSound.pause();
    this.quenchedSound.currentTime = 0;
  }
}
