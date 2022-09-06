import React from 'react'
import { Fade } from 'react-slideshow-image'
import '../../../node_modules/react-slideshow-image/dist/styles.css'

const Slideshow: React.FC = () => {
  const slideImages = [
    {
      url: '/assets/images/bakery/neu_theke.jpeg',
      caption: 'Slide 1',
    },
    {
      url: '/assets/images/bakery/neu_theke2.jpeg',
      caption: 'Slide 2',
    },
    {
      url: '/assets/images/bakery/neu_theke3.jpeg',
      caption: 'Slide 3',
    },
  ]
  return (
    <div style={styles.fade} className="slide-container">
      <Fade arrows={false}>
        {slideImages.map((slideImage, index) => (
          <div style={styles.fade} className="each-fade" key={index}>
            <div
              style={{
                ...styles.fade,
                backgroundImage: `url(${slideImage.url})`,
              }}
            >
              <span>{slideImage.caption}</span>
            </div>
          </div>
        ))}
      </Fade>
    </div>
  )
}

const styles = {
  fade: {
    height: '300px',
  },
}

export default Slideshow
