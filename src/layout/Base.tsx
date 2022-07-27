import { Meta } from "./Meta";
import { AppConfig } from "../utils/AppConfig";
import { Footer } from "../components/footer/Index";
import { Navigation } from "../components/navigation";

const Base: React.FC = ({children}) => (
  <div className="antialiased text-gray-600">
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Navigation />
    {children}
    <Footer />
  </div>
);

export { Base };
