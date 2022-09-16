import React from 'react'
import axios from 'axios'
import { Fade } from 'react-slideshow-image'
import '../../../node_modules/react-slideshow-image/dist/styles.css'
import { Box, Typography } from '@mui/material'

const RSSFeed: React.FC = () => {
  const KEY = 'qazc8r9hi6tso17ml77ug9u21i4ydytiaslmbbeh'
  const URL =
    'https://www.homburg.de/index.php/aktuelles/nachrichten?format=feed&type=rss'

  const [feed, setFeed] = React.useState<any>([])

  React.useEffect(() => {
    const RSS_TO_JSON = `https://api.rss2json.com/v1/api.json?api_key=${KEY}&rss_url=${URL}`

    axios
      .get(RSS_TO_JSON, {})
      .then((res) => {
        console.log(res)
        let items = res.data.items
        console.log(items)
        setFeed(items.slice(Math.max(items.length - 5, 0)))
      })
      .catch((error) => console.error(error))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Fade arrows={false}>
      {feed.map((item: any, index: any) => (
        <div style={{ ...styles.fade }} className="each-fade" key={index}>
          <Box
            sx={{
              ...styles.fade,
              position: 'relative',
              backgroundImage: `url(${item.thumbnail})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              borderRadius: '12px',
              overflow: 'hidden',
              padding: 2,
              height: '100%',
              textShadow: '0 0 0 rgba(0,0,0,0.25)',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                bgcolor: 'rgba(0,0,0,0.66)',
              }}
            />
            <Typography
              fontSize={24}
              sx={{ position: 'relative' }}
              color="common.white"
            >
              {item.title}
            </Typography>
          </Box>
        </div>
      ))}
    </Fade>
  )
}

const styles = {
  fade: {
    height: '300px',
  },
}

export default RSSFeed
