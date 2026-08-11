import type { CareerTodoItem } from '../game/subjects/types';

interface TodoPanelProps {
  todos: CareerTodoItem[];
  gold: number;
  onHire: (todo: CareerTodoItem) => void;
}

export function TodoPanel({ todos, gold, onHire }: TodoPanelProps) {
  if (!todos.length) return null;

  return (
    <section className="panel todo-panel" aria-live="polite">
      <h2>Career wishes</h2>
      <p className="muted">
        Subjects who want a promotion. Pay their training cost when capacity
        allows (guards and soldiers may seek knighthood; soldiers may become
        generals — one per barracks).
      </p>
      <ul className="market-list">
        {todos.map((todo) => {
          const disabled = gold < todo.cost;
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
