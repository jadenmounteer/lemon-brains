import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SpeechSynthesisService {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  speak(text: string): void {
    if (!this.isSupported() || !text.trim()) {
      return;
    }

    const synthesis = window.speechSynthesis;
    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.lang = 'en-US';

    const voice = this.pickEnglishVoice(synthesis.getVoices());
    if (voice) {
      try {
        utterance.voice = voice;
      } catch {
        // Ignore invalid voice objects (common in test doubles).
      }
    }

    synthesis.speak(utterance);
  }

  cancel(): void {
    if (!this.isSupported()) {
      return;
    }
    window.speechSynthesis.cancel();
  }

  private pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices.length) {
      return null;
    }

    return (
      voices.find((voice) => voice.lang === 'en-US' && /samantha|karen|moira|google/i.test(voice.name)) ??
      voices.find((voice) => voice.lang.startsWith('en-US')) ??
      voices.find((voice) => voice.lang.startsWith('en')) ??
      null
    );
  }
}
