import { Injectable } from '@angular/core';
import { assetUrl } from '../utils/asset-url';

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
  private kingZombieSpawnSound: HTMLAudioElement;

  constructor() {
    this.music = new Audio();
    this.music.src = assetUrl('assets/audio/soundtrack.m4a');
    this.music.loop = true;
    this.music.volume = 0.07;
    this.zombieSound = new Audio();
    this.zombieSound.src = assetUrl('assets/audio/zombie sound.m4a');
    this.zombieSound.volume = 0.2;

    this.quenchedSound = new Audio(assetUrl('assets/audio/quenched.m4a'));
    this.quenchedSound.volume = 0.4;

    this.kingZombieSpawnSound = new Audio(assetUrl('assets/audio/bow-to-me.m4a'));
    this.kingZombieSpawnSound.volume = 0.4;
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
    this.zombieSound.volume = normalizedVolume * 0.7;
  }

  private startRandomZombieSounds() {
    if (this.zombieSoundInterval) {
      clearInterval(this.zombieSoundInterval);
    }

    this.zombieSoundInterval = setInterval(() => {
      if (this.isMusicPlaying) {
        this.playZombieSound();
      }
    }, Math.random() * 10000 + 30000);
  }

  playZombieSound() {
    const zombieSound = new Audio(assetUrl('assets/audio/zombie sound.m4a'));
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

  playKingZombieSpawnSound() {
    if (!this.isMuted) {
      this.kingZombieSpawnSound.currentTime = 0;
      this.kingZombieSpawnSound.play();
    }
  }

  cleanup() {
    this.pause();
    this.stopRandomZombieSounds();
    this.music.pause();
    this.music.currentTime = 0;
    this.zombieSound.pause();
    this.zombieSound.currentTime = 0;
    this.quenchedSound.pause();
    this.quenchedSound.currentTime = 0;
    this.kingZombieSpawnSound.pause();
    this.kingZombieSpawnSound.currentTime = 0;
  }
}
