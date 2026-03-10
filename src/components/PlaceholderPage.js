import React from 'react';
import './PlaceholderPage.css';

export default function PlaceholderPage({ title }) {
  return (
    <div className="wf-placeholder">
      <h2 className="wf-placeholder-title">{title}</h2>
      <p className="wf-placeholder-subtitle">Coming soon</p>
    </div>
  );
}
