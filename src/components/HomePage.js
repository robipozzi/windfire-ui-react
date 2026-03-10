import React, { useState } from 'react';
import './HomePage.css';
import Header from './Header';
import Footer from './Footer';
import WindfireLogo from './WindfireLogo';
import PlaceholderPage from './PlaceholderPage';
import RestaurantsPage from './RestaurantsPage';

const PAGE_TITLES = {
  calendar: 'Calendar',
  maps: 'Maps',
};

export default function HomePage({ user, onLogout }) {
  const [currentPage, setCurrentPage] = useState('home');

  function renderBody() {
    if (currentPage === 'home') {
      return (
        <div className="wf-home-body">
          <WindfireLogo size="large" />
        </div>
      );
    }
    if (currentPage === 'restaurants') {
      return <RestaurantsPage />;
    }
    return <PlaceholderPage title={PAGE_TITLES[currentPage]} />;
  }

  return (
    <div className="wf-home">
      <Header
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
        onLogout={onLogout}
      />
      <main className="wf-home-main">
        {renderBody()}
      </main>
      <Footer />
    </div>
  );
}
