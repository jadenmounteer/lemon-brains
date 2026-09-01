import type { LearningOption, LearningQuestion } from '@knowledge-quest/learning';

interface QuestionOptionsProps {
  question: LearningQuestion;
  wrongValue?: string | number | null;
  locked?: boolean;
  onSelect: (option: LearningOption) => void;
}

export function QuestionOptions({
  question,
  wrongValue = null,
  locked = false,
  onSelect,
}: QuestionOptionsProps) {
  return (
    <div className={`question-options display-${question.optionDisplay}`}>
      {question.options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={[
            'question-option',
            question.optionDisplay === 'colorSwatch' ? 'color-option' : '',
            question.optionDisplay === 'shapeSvg' ? 'shape-option' : '',
            question.optionDisplay === 'emoji' ? 'emoji-option' : '',
            wrongValue === option.value ? 'wrong' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            question.optionDisplay === 'colorSwatch' && option.colorHex
              ? { backgroundColor: option.colorHex }
              : undefined
          }
          disabled={locked}
          onClick={() => onSelect(option)}
        >
          {question.optionDisplay === 'text' && <span>{option.label}</span>}
          {question.optionDisplay === 'emoji' && (
            <span className="emoji-label">{option.label}</span>
          )}
          {question.optionDisplay === 'shapeSvg' && (
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path
                d={option.svgPath}
                fill={option.fillColor ?? '#ccc'}
                stroke="#333"
                strokeWidth="2"
              />
            </svg>
          )}
          {question.optionDisplay === 'colorSwatch' && (
            <span className="sr-only">
              {option.label ?? String(option.value)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
