import React, { useState } from 'react';

export default function QuizGame({ onFinish }) {
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const correctIndex = 1;
  const isCorrect = selected === correctIndex;

  const handleAnswer = (index) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
  };

  const reset = () => {
    setSelected(null);
    setAnswered(false);
  };

  const finish = () => {
    reset();
    if (onFinish) {
      onFinish();
    }
  };

  return (
    <div className="quiz-overlay">
      <div className="quiz-box">
        <h2>🎯 Вопрос</h2>
        <p>Сколько стоит билет из Бали в Куала Лумпур?</p>
        <div className="options">
          {['$40', '$80', '$120'].map((option, idx) => {
            let className = 'option-button';
            if (answered && idx === selected) {
              className += isCorrect ? ' correct' : ' wrong';
            }
            return (
              <button
                key={idx}
                className={className}
                onClick={() => handleAnswer(idx)}
              >
                {option}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="feedback">
            {isCorrect ? '✅ \u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E!' : '❌ \u041D\u0435\u0432\u0435\u0440\u043D\u043E.'}
            {isCorrect ? (
              <button className="retry-button" onClick={finish}>
                \u0417\u0430\u043A\u0440\u044B\u0442\u044C
              </button>
            ) : (
              <button className="retry-button" onClick={reset}>
                \u041F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u0442\u044C \u0441\u043D\u043E\u0432\u0430
              </button>
            )}
          </div>
        )}
        {!answered && (
          <button className="retry-button" onClick={finish}>
            \u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F
          </button>
        )}
      </div>
    </div>
  );
}
