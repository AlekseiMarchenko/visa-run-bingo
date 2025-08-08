import React, { useState } from 'react';
import { motion } from 'framer-motion';

// A single quiz question. You can extend this structure to support multiple questions.
const quizData = {
  question: 'Сколько стоит билет из Бали в Куала Лумпур?',
  options: ['$40', '$80', '$120'],
  correctIndex: 1,
};

// QuizGame renders a playful quiz card with animated feedback.
export default function QuizGame() {
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);

  const isCorrect = selected === quizData.correctIndex;

  const handleAnswer = (index) => {
    if (!answered) {
      setSelected(index);
      setAnswered(true);
    }
  };

  const resetQuiz = () => {
    setSelected(null);
    setAnswered(false);
  };

  return (
    <div className="quiz-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="quiz-card"
      >
        <h1>🎯 ВизаРан Квиз</h1>
        <p>{quizData.question}</p>
        <div className="options">
          {quizData.options.map((option, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.95 }}
              className={
                answered
                  ? index === selected
                    ? isCorrect
                      ? 'option-button correct'
                      : 'option-button wrong'
                    : 'option-button'
                  : 'option-button'
              }
              onClick={() => handleAnswer(index)}
            >
              {option}
            </motion.button>
          ))}
        </div>
        {answered && (
          <div className="feedback">
            {isCorrect ? '✅ Правильно!' : '❌ Неверно. Попробуй ещё раз!'}
            {!isCorrect && (
              <button className="retry-button" onClick={resetQuiz}>
                Попробовать снова
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
