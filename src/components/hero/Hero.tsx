import styles from "./Hero.module.scss";

const Hero = () => (
  <div className={styles.hero}>
    <div className={styles.overlay} />
    <div className={styles.logo}>
      <img src="/assets/images/products/Type=Baguette.svg"></img>
    </div>
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
  </div>
);

export { Hero };
