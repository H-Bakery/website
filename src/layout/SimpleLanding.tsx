import React from 'react';

import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { LandingHero } from '../components/LandingHero';
import { Letter } from '../components/Letter';
import { Meta } from '../components/Meta';
import { AppConfig } from '../utils/AppConfig';

const SimpleLanding = () => (
  <div className="antialiased text-gray-600">
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Header />
    <LandingHero
      title="Hi, I’m Dave."
      subtitle="I’m a creative director, designer, and developer who helps organizations
        get results from their websites and products."
    />
    <Letter />
    <Footer />
  </div>
);

export { SimpleLanding };
