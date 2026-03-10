import React, { useState, useEffect } from 'react';
import './RestaurantsPage.css';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = process.env.REACT_APP_RESTAURANTS_URL || 'http://localhost:8082/restaurants';
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        setRestaurants(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="wf-restaurants-status">
        <p className="wf-restaurants-loading">Loading restaurants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wf-restaurants-status">
        <p className="wf-restaurants-error">Failed to load restaurants: {error}</p>
      </div>
    );
  }

  return (
    <div className="wf-restaurants">
      <h2 className="wf-restaurants-title">Restaurants</h2>
      <div className="wf-restaurants-table-wrapper">
        <table className="wf-restaurants-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Cuisine</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r, index) => (
              <tr key={r.name ?? index}>
                <td>{r.name}</td>
                <td>{`${r.address.street} - ${r.address.zipCode}, ${r.address.city}`}</td>
                <td>{r.cuisine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
