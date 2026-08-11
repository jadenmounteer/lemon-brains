import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  LearningOption,
  LearningQuestion,
  OptionDisplay,
} from '../../learning/models/learning-question';

@Component({
  selector: 'app-question-options',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './question-options.component.html',
  styleUrl: './question-options.component.scss',
})
export class QuestionOptionsComponent {
  @Input({ required: true }) question!: LearningQuestion;
  @Input() selectedAnswer: string | number | null = null;
  @Input() wrongAnswer: string | number | null = null;
  @Output() optionSelected = new EventEmitter<string | number>();

  get optionDisplay(): OptionDisplay {
    return this.question.optionDisplay;
  }

  trackByValue(_index: number, option: LearningOption): string | number {
    return option.value;
  }

  onSelect(option: LearningOption): void {
    if (this.selectedAnswer !== null) {
      return;
    }
    this.optionSelected.emit(option.value);
  }
}
