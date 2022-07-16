import { Meta } from './Meta';
import { AppConfig } from '../utils/AppConfig';
import { Banner } from '../components/Banner';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { VerticalFeatures } from '../components/VerticalFeatures';

const Base = () => (
  <div className="antialiased text-gray-600">
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Hero />
    <VerticalFeatures />
    <Banner />
    <Footer />
  </div>
);

export { Base };