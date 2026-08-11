import type { CareerTodoItem } from '../game/subjects/types';

interface TodoPanelProps {
  todos: CareerTodoItem[];
  gold: number;
  infiniteGold?: boolean;
  onHire: (todo: CareerTodoItem) => void;
  onHide: () => void;
}

export function TodoPanel({
  todos,
  gold,
  infiniteGold = false,
  onHire,
  onHide,
}: TodoPanelProps) {
  if (!todos.length) return null;

  return (
    <section className="panel todo-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>Career wishes</h2>
        <button type="button" className="inspector-close" onClick={onHide}>
          Hide
        </button>
      </div>
      <p className="muted">
        Subjects who want a promotion. Pay their training cost when capacity
        allows. Reopen anytime from the Wishes button in the top bar.
      </p>
      <ul className="market-list">
        {todos.map((todo) => {
          const disabled = !infiniteGold && gold < todo.cost;
          return (
            <li key={`${todo.subjectId}-${todo.targetRole}`} className="market-row">
              <div>
                <strong>{todo.name}</strong>
                <span className="muted">
                  {' '}
                  wants to become {todo.targetLabel}
                </span>
                <p className="muted">{todo.cost}g</p>
              </div>
              <button
                type="button"
                className="market-buy"
                disabled={disabled}
                onClick={() => onHire(todo)}
              >
                Hire
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
