import React from 'react';
import './StatsCard.css';

const StatsCard = ({ title, amount, type, trend, icon: Icon }) => {
  return (
    <div className={`stats-card stats-card--${type}`}>
      <div className="stats-card__content">
        <div className="stats-card__info">
          <h3 className="stats-card__title">{title}</h3>
          <p className="stats-card__amount">{amount}</p>
          {trend && (
            <span className={`stats-card__trend stats-card__trend--${trend.direction}`}>
              {trend.value}
            </span>
          )}
        </div>
        <div className="stats-card__icon">
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;