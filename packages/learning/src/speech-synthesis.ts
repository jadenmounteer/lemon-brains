/** British / proper female voices that read closest to a Mary Poppins tone. */
const PREFERRED_VOICE_PATTERN =
  /google uk english female|kate|serena|martha|fiona|moira|karen|samantha/i;

export class SpeechSynthesisService {
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (!this.isSupported()) {
      return;
    }

    this.cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      this.cachedVoices = window.speechSynthesis.getVoices();
    });
  }

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
    utterance.rate = 0.8;
    utterance.pitch = 1.15;
    utterance.lang = 'en-GB';

    const voice = this.pickPoppinsVoice(this.getVoices());
    if (voice) {
      try {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'en-GB';
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

  private getVoices(): SpeechSynthesisVoice[] {
    const live = window.speechSynthesis.getVoices();
    if (live.length) {
      this.cachedVoices = live;
    }
    return this.cachedVoices;
  }

  private pickPoppinsVoice(
    voices: SpeechSynthesisVoice[]
  ): SpeechSynthesisVoice | null {
    if (!voices.length) {
      return null;
    }

    const british = voices.filter((voice) => /^en-GB\b/i.test(voice.lang));
    const english = voices.filter((voice) => /^en\b/i.test(voice.lang));

    return (
      british.find((voice) => PREFERRED_VOICE_PATTERN.test(voice.name)) ??
      english.find((voice) => PREFERRED_VOICE_PATTERN.test(voice.name)) ??
      british[0] ??
      english.find((voice) => /female|woman|girl/i.test(voice.name)) ??
      english[0] ??
      null
    );
  }
}
