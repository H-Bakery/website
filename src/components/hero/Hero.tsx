
const Hero = () => (
  <div className='hero'>
    <div className='overlay' />
    <div className='logo'>
      <img src="/assets/images/products/Type=Baguette.svg" />
    </div>
    <video
      className='backgroundVideo'
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

// .overlay {
//   background-color: #000;
//   opacity: 0.6;
//   filter: alpha(opacity=60); /* For IE8 and earlier */
//   z-index: 1;
//   width: 100vw;
//   height: 100vh;
//   position: absolute;
// }

// .logo {
//   width: 100px;
//   height: 100px;
//   position: absolute;
// }

// .backgroundVideo {
//   width: 100vw;
//   height: 100vh;
//   object-fit: cover;
//   left: 0;
//   right: 0;
//   top: 0;
//   bottom: 0;
//   z-index: -1;
// }
