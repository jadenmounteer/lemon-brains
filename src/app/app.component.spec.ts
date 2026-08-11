import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideCurricula } from './learning/provide-curricula';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideCurricula()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should start on the main menu', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.isGameView).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-main-menu')).toBeTruthy();
  });
});
