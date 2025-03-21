import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private music: HTMLAudioElement;
  private zombieSound: HTMLAudioElement;
  private isMusicPlaying = false;
  private zombieSoundInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.music = new Audio();
    this.music.src = 'assets/audio/soundtrack.mp3';
    this.music.loop = true;

    this.zombieSound = new Audio();
    this.zombieSound.src = 'assets/audio/zombie sound.mp3';
    this.zombieSound.volume = 0.7; // Slightly lower volume for sound effect
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
    }, Math.random() * 10000 + 5000); // Random interval between 5000ms and 15000ms
  }

  playZombieSound() {
    // Create a new Audio instance each time to allow overlapping sounds
    const zombieSound = new Audio('assets/audio/zombie sound.mp3');
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

  // Clean up method to be called when the game is destroyed
  cleanup() {
    this.pause();
    this.stopRandomZombieSounds();
  }
}
