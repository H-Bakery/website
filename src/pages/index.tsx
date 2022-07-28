import { Base } from '../layout/Base';
import { Hero } from '../components/home/hero/Hero';
import Map from '../components/home/map';
import Products from '../components/home/products';
import Testimonial from '../components/home/testimonial';

const Index = () => (
  <Base>
    <Hero />
    <Map />
    <Products />
    <Testimonial />
  </Base>
);

export default Index;
