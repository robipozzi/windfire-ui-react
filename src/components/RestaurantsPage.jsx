import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, SessionExpiredError } from '../auth/AuthContext';
import { safeHttpUrl } from '../utils/safeUrl';
import './RestaurantsPage.css';

const EMPTY_FORM = {
  name: '', street: '', zipCode: '', city: '',
  province: '', region: '', country: '', cuisine: '',
  phone: '', mobile: '', email: '', website: '',
};

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Link only http(s) URLs; anything else is shown as plain text.
function renderWebsite(value, fallback) {
  if (!value) return fallback;
  const safe = safeHttpUrl(value);
  return safe
    ? <a href={safe} target="_blank" rel="noopener noreferrer">{value}</a>
    : value;
}

// Build a mailto: link only for plain addresses; anything else is shown as plain text.
function renderEmail(value, fallback) {
  if (!value) return fallback;
  return EMAIL_RE.test(value) && !/[:/]/.test(value)
    ? <a href={`mailto:${value}`}>{value}</a>
    : value;
}

// Turn a failed response into a readable message.
function requestError(res) {
  if (res.status === 403) {
    return new Error('You are not authorized to perform this action.');
  }
  return new Error(`Request failed: ${res.status} ${res.statusText}`);
}

// fetch() rejects with a TypeError when no usable response arrives (server down,
// untrusted certificate, CORS rejection); the browser's own text ("Load failed") says nothing useful.
function errorMessage(err) {
  if (err instanceof TypeError) {
    return 'Cannot reach the Restaurants API (network, certificate or CORS error).';
  }
  return err.message;
}

export default function RestaurantsPage() {
  const { getToken, hasApiRole } = useAuth();
  // Only writers may add or delete; the backend rejects anyone else with 403.
  const canWrite = hasApiRole('restaurants-writer');
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // Every request gets its token from getToken(), which refreshes it when it expires within 30 s.
  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
  }, [getToken]);

  useEffect(() => {
    const url = import.meta.env.VITE_RESTAURANTS_URL;
    authFetch(url)
      .then((res) => {
        if (!res.ok) throw requestError(res);
        return res.json();
      })
      .then((data) => {
        setRestaurants(data);
        setLoading(false);
      })
      .catch((err) => {
        // On session expiry getToken() redirects to the Keycloak login page; nothing to show here.
        if (err instanceof SessionExpiredError) return;
        setError(errorMessage(err));
        setLoading(false);
      });
  }, [authFetch]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleCancel() {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }

  async function handleDelete(restaurant) {
    if (!canWrite) return;
    setConfirmDeleteId(null);
    setDeletingId(restaurant.id);
    setDeleteError(null);
    const url = `${import.meta.env.VITE_RESTAURANTS_URL}/${restaurant.id}`;
    try {
      const res = await authFetch(url, { method: 'DELETE' });
      if (!res.ok) throw requestError(res);
      setRestaurants((prev) => prev.filter((r) => r.id !== restaurant.id));
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setFormError(null);

    const newRestaurant = {
      name: formData.name,
      address: {
        street: formData.street,
        zipCode: formData.zipCode,
        city: formData.city,
        province: formData.province,
        region: formData.region,
        country: formData.country,
      },
      cuisine: formData.cuisine,
      phone: formData.phone,
      mobile: formData.mobile,
      email: formData.email,
      website: formData.website,
    };

    const url = import.meta.env.VITE_RESTAURANTS_URL;
    try {
      const res = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRestaurant),
      });
      if (!res.ok) throw requestError(res);
      setRestaurants((prev) => [...prev, newRestaurant]);
      handleCancel();
    } catch (err) {
      setFormError(errorMessage(err));
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
        {canWrite && !showForm && (
          <button className="wf-btn-add" onClick={() => setShowForm(true)}>
            + Add Restaurant
          </button>
        )}
      </div>

      {canWrite && showForm && (
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
            <div className="wf-form-field">
              <label htmlFor="province">Province</label>
              <input
                id="province"
                name="province"
                type="text"
                value={formData.province}
                onChange={handleFormChange}
                placeholder="Province"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="region">Region</label>
              <input
                id="region"
                name="region"
                type="text"
                value={formData.region}
                onChange={handleFormChange}
                placeholder="Region"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="country">Country</label>
              <input
                id="country"
                name="country"
                type="text"
                value={formData.country}
                onChange={handleFormChange}
                placeholder="Country"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleFormChange}
                placeholder="Phone number"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="mobile">Mobile Number</label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                value={formData.mobile}
                onChange={handleFormChange}
                placeholder="Mobile number"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleFormChange}
                placeholder="Email address"
              />
            </div>
            <div className="wf-form-field">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="url"
                value={formData.website}
                onChange={handleFormChange}
                placeholder="https://..."
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

      {deleteError && (
        <p className="wf-delete-error">Failed to delete restaurant: {deleteError}</p>
      )}

      <div className="wf-restaurants-table-wrapper">
        <table className="wf-restaurants-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Region</th>
              <th>Province</th>
              <th>Cuisine</th>
              <th>Website</th>
              {canWrite && <th className="wf-col-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r, index) => (
              <tr key={r.id ?? index}>
                <td>
                  <button className="wf-name-link" onClick={() => setSelectedRestaurant(r)}>
                    {r.name}
                  </button>
                </td>
                <td>{`${r.address.street} - ${r.address.zipCode}, ${r.address.city}`}</td>
                <td>{r.address.region}</td>
                <td>{r.address.province}</td>
                <td>{r.cuisine}</td>
                <td>{renderWebsite(r.website, '')}</td>
                {canWrite && (
                <td className="wf-col-actions">
                  {confirmDeleteId === r.id ? (
                    <span className="wf-delete-confirm">
                      <button
                        className="wf-btn-confirm-yes"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                      >
                        {deletingId === r.id ? <span className="wf-delete-spinner" /> : 'Yes'}
                      </button>
                      <button
                        className="wf-btn-confirm-no"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === r.id}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      className="wf-btn-delete"
                      title="Delete restaurant"
                      disabled={deletingId === r.id}
                      onClick={() => setConfirmDeleteId(r.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRestaurant && (
        <div className="wf-modal-overlay" onClick={() => setSelectedRestaurant(null)}>
          <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wf-modal-header">
              <h3 className="wf-modal-title">{selectedRestaurant.name}</h3>
              <button className="wf-modal-close" onClick={() => setSelectedRestaurant(null)}>✕</button>
            </div>
            <div className="wf-modal-body">
              <div className="wf-modal-section">
                <h4 className="wf-modal-section-title">Address</h4>
                <div className="wf-modal-grid">
                  <span className="wf-modal-label">Street</span>
                  <span className="wf-modal-value">{selectedRestaurant.address?.street || '—'}</span>
                  <span className="wf-modal-label">ZIP Code</span>
                  <span className="wf-modal-value">{selectedRestaurant.address?.zipCode || '—'}</span>
                  <span className="wf-modal-label">City</span>
                  <span className="wf-modal-value">{selectedRestaurant.address?.city || '—'}</span>
                  <span className="wf-modal-label">Province</span>
                  <span className="wf-modal-value">{selectedRestaurant.address?.province || '—'}</span>
                  <span className="wf-modal-label">Region</span>
                  <span className="wf-modal-value">{selectedRestaurant.address?.region || '—'}</span>
                  <span className="wf-modal-label">Country</span>
                  <span className="wf-modal-value">{selectedRestaurant.address?.country || '—'}</span>
                </div>
              </div>
              <div className="wf-modal-section">
                <h4 className="wf-modal-section-title">Details</h4>
                <div className="wf-modal-grid">
                  <span className="wf-modal-label">Cuisine</span>
                  <span className="wf-modal-value">{selectedRestaurant.cuisine || '—'}</span>
                  <span className="wf-modal-label">Phone</span>
                  <span className="wf-modal-value">{selectedRestaurant.phone || '—'}</span>
                  <span className="wf-modal-label">Mobile</span>
                  <span className="wf-modal-value">{selectedRestaurant.mobile || '—'}</span>
                  <span className="wf-modal-label">Email</span>
                  <span className="wf-modal-value">
                    {renderEmail(selectedRestaurant.email, '—')}
                  </span>
                  <span className="wf-modal-label">Website</span>
                  <span className="wf-modal-value">
                    {renderWebsite(selectedRestaurant.website, '—')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}