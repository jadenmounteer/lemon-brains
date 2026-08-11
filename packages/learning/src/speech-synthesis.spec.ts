import { SpeechSynthesisService } from './speech-synthesis';

describe('SpeechSynthesisService', () => {
  let service: SpeechSynthesisService;
  let speakSpy: jasmine.Spy;
  let cancelSpy: jasmine.Spy;
  let getVoicesSpy: jasmine.Spy;
  let addEventListenerSpy: jasmine.Spy;

  beforeEach(() => {
    speakSpy = jasmine.createSpy('speak');
    cancelSpy = jasmine.createSpy('cancel');
    getVoicesSpy = jasmine.createSpy('getVoices').and.returnValue([
      { lang: 'en-US', name: 'Samantha' } as SpeechSynthesisVoice,
      { lang: 'en-GB', name: 'Kate' } as SpeechSynthesisVoice,
      { lang: 'fr-FR', name: 'Thomas' } as SpeechSynthesisVoice,
    ]);
    addEventListenerSpy = jasmine.createSpy('addEventListener');

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: speakSpy,
        cancel: cancelSpy,
        getVoices: getVoicesSpy,
        addEventListener: addEventListenerSpy,
      },
    });

    service = new SpeechSynthesisService();
  });

  it('reports support when speechSynthesis is available', () => {
    expect(service.isSupported()).toBeTrue();
  });

  it('speaks with a British Poppins-style voice preference', () => {
    service.speak('the letter N');

    expect(cancelSpy).toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalled();
    const utterance = speakSpy.calls.mostRecent()
      .args[0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('the letter N');
    expect(utterance.rate).toBeCloseTo(0.8, 2);
    expect(utterance.pitch).toBeCloseTo(1.15, 2);
    expect(utterance.lang).toBe('en-GB');
  });

  it('cancels speech', () => {
    service.cancel();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('reports unsupported when speechSynthesis is missing', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });

    const unsupported = new SpeechSynthesisService();
    expect(unsupported.isSupported()).toBeFalse();
    unsupported.speak('hello');
    expect(speakSpy).not.toHaveBeenCalled();
  });
});
