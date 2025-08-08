import React from 'react';

// TaskList displays each available task along with a button to
// complete it. Completed tasks show a check mark instead.
const TaskList = ({ tasks, onComplete }) => {
  return (
    <div className="tasks">
      <h2>Задания</h2>
      <ul>
        {tasks.map((t) => (
          <li key={t.id}>
            <span>{t.title}</span>
            {t.done ? (
              <span className="check">✔</span>
            ) : (
              <button className="primary" onClick={() => onComplete(t.id)}>
                Выполнить
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;
