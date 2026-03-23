import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import './RestaurantsPage.css';

const EMPTY_FORM = { name: '', street: '', zipCode: '', city: '', cuisine: '' };

export default function RestaurantsPage() {
  const { tokens } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const url = process.env.REACT_APP_RESTAURANTS_URL;
    console.log('===> (RestaurantsPage) - url:', url);
    console.log('===> (RestaurantsPage) - tokens:', tokens?.access_token);
    fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens?.access_token}`,
      },
    })
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
  }, [tokens?.access_token]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleCancel() {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const newRestaurant = {
      name: formData.name,
      address: {
        street: formData.street,
        zipCode: formData.zipCode,
        city: formData.city,
      },
      cuisine: formData.cuisine,
    };

    const url = process.env.REACT_APP_RESTAURANTS_URL;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.access_token}`,
        },
        body: JSON.stringify(newRestaurant),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      setRestaurants((prev) => [...prev, newRestaurant]);
      handleCancel();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

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
      <div className="wf-restaurants-header">
        <h2 className="wf-restaurants-title">Restaurants</h2>
        {!showForm && (
          <button className="wf-btn-add" onClick={() => setShowForm(true)}>
            + Add Restaurant
          </button>
        )}
      </div>

      {showForm && (
        <form className="wf-restaurant-form" onSubmit={handleSubmit}>
          <h3 className="wf-form-title">New Restaurant</h3>
          <div className="wf-form-grid">
            <div className="wf-form-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Restaurant name"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="cuisine">Cuisine</label>
              <input
                id="cuisine"
                name="cuisine"
                type="text"
                required
                value={formData.cuisine}
                onChange={handleFormChange}
                placeholder="e.g. Italian"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="street">Street</label>
              <input
                id="street"
                name="street"
                type="text"
                required
                value={formData.street}
                onChange={handleFormChange}
                placeholder="Street address"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="zipCode">ZIP Code</label>
              <input
                id="zipCode"
                name="zipCode"
                type="text"
                required
                value={formData.zipCode}
                onChange={handleFormChange}
                placeholder="ZIP code"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                type="text"
                required
                value={formData.city}
                onChange={handleFormChange}
                placeholder="City"
              />
            </div>
          </div>
          {formError && <p className="wf-form-error">{formError}</p>}
          <div className="wf-form-actions">
            <button type="submit" className="wf-btn-submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="wf-btn-cancel" onClick={handleCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}

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
