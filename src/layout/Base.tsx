import { Meta } from "./Meta";
import { AppConfig } from "../utils/AppConfig";
import { Footer } from "../components/footer/Index";
import { Header } from "../components/header";

const Base: React.FC = ({children}) => (
  <div className="antialiased text-gray-600">
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Header />
    {children}
    <Footer />
  </div>
);

export { Base };
