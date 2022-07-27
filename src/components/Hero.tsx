import { Background } from "./Background";
import { Section } from "./Section";
import styles from "./Hero.module.scss";

const Hero = () => (
  <>
    <video
      className={styles.backgroundVideo}
      id="background-video"
      autoPlay
      muted
      loop
    >
      <source src="/assets/images/stock/bg_video.mp4" type="video/mp4" />
      <source src="/assets/images/stock/bg_video.mp4" type="video/ogg" />
      Your browser does not support the video tag.
    </video>
  </>
);

export { Hero };
