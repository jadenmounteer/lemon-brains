import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private audio: HTMLAudioElement;
  private isPlaying = false;

  constructor() {
    this.audio = new Audio();
    this.audio.src = 'assets/audio/soundtrack.mp3';
    this.audio.loop = true;
  }

  play() {
    if (!this.isPlaying) {
      this.audio.play().catch((error) => {
        console.warn('Audio playback failed:', error);
      });
      this.isPlaying = true;
    }
  }

  pause() {
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }
}
