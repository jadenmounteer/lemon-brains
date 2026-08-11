import { SpeechSynthesisService } from './speech-synthesis.service';

describe('SpeechSynthesisService', () => {
  let service: SpeechSynthesisService;
  let speakSpy: jasmine.Spy;
  let cancelSpy: jasmine.Spy;
  let getVoicesSpy: jasmine.Spy;

  beforeEach(() => {
    service = new SpeechSynthesisService();
    speakSpy = jasmine.createSpy('speak');
    cancelSpy = jasmine.createSpy('cancel');
    getVoicesSpy = jasmine.createSpy('getVoices').and.returnValue([
      { lang: 'en-US', name: 'Samantha' } as SpeechSynthesisVoice,
      { lang: 'fr-FR', name: 'Thomas' } as SpeechSynthesisVoice,
    ]);

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: speakSpy,
        cancel: cancelSpy,
        getVoices: getVoicesSpy,
      },
    });
  });

  it('reports support when speechSynthesis is available', () => {
    expect(service.isSupported()).toBeTrue();
  });

  it('speaks text after canceling prior utterances', () => {
    service.speak('the letter N');

    expect(cancelSpy).toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalled();
    const utterance = speakSpy.calls.mostRecent().args[0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('the letter N');
    expect(utterance.rate).toBeCloseTo(0.85, 2);
    expect(utterance.lang).toBe('en-US');
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

    expect(service.isSupported()).toBeFalse();
    service.speak('hello');
    expect(speakSpy).not.toHaveBeenCalled();
  });
});
