import React from 'react';

// Grid component renders a simple 3×3 grid of cells. Each cell
// displays either the city name or a question mark if unopened.
const Grid = ({ cities }) => {
  return (
    <div className="grid">
      {cities.map((c, idx) => (
        <div key={idx} className={`cell ${c.opened ? 'opened' : ''}`}>
          {c.opened ? c.name : '❓'}
        </div>
      ))}
    </div>
  );
};

export default Grid;
