import { Base } from '../layout/Base';
import { Hero } from '../components/home/hero/Hero';
import Map from '../components/home/map';
import Products from '../components/home/products';
import Testimonial from '../components/home/testimonial';
import News from '../components/home/news';

const Index = () => (
  <Base>
    <Hero />
    <Map />
    <Products />
    <Testimonial />
    <News />
  </Base>
);

export default Index;
