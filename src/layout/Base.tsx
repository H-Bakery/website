import { Meta } from './Meta';
import { AppConfig } from '../utils/AppConfig';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { VerticalFeatures } from '../components/VerticalFeatures';

const Base = () => (
  <div className="antialiased text-gray-600">
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Hero />
    <VerticalFeatures />
    <Footer />
  </div>
);

export { Base };