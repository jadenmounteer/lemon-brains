import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';

import { GameComponent } from './game.component';
import { provideCurricula } from '../../learning/provide-curricula';
import { AudioService } from '../../services/audio.service';

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [
        provideCurricula(),
        provideAnimations(),
        {
          provide: AudioService,
          useValue: {
            play: () => undefined,
            toggle: () => false,
            playQuenchedSound: () => undefined,
            playZombieSound: () => undefined,
            playKingSound: () => undefined,
            stop: () => undefined,
            cleanup: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads a learning question from the registry', () => {
    component.generateNewQuestion();
    expect(component.currentQuestion).toBeTruthy();
    expect(component.currentQuestion?.options.length).toBe(4);
    expect(component.currentQuestion?.prompt).toBeTruthy();
  });
});
