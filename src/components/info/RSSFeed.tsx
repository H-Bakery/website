import { Box, Container, Typography } from "@mui/material";
import React from "react";
import * as reader from "feed-reader";
import axios from "axios";
import { Fade } from "react-slideshow-image";
import {QRCodeSVG} from 'qrcode.react';
import "../../../node_modules/react-slideshow-image/dist/styles.css";

const RSSFeed: React.FC = () => {
    const KEY = process.env.NEXT_PUBLIC_RSS_KEY
  const URL =
    "https://www.homburg.de/index.php/aktuelles/nachrichten?format=feed&type=rss";

  const [feed, setFeed] = React.useState<any>([]);

  React.useEffect(() => {

    const RSS_TO_JSON = `https://api.rss2json.com/v1/api.json?api_key=${KEY}&rss_url=${URL}`;

    axios
      .get(RSS_TO_JSON, {
        // headers: {
        //   "Access-Control-Allow-Origin": "*",
        //   'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
        // },
      })
      .then((res) => {
          console.log(res);
          let items = res.data.items
          console.log(items);
        setFeed(items.slice(Math.max(items.length - 5, 0)))
      })
      .catch((error) => console.error(error));
    // console.log(reader);
    // console.log(reader.getRequestOptions());
    // reader.setRequestOptions({
    //   headers: {
    //     "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    //     "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
    //     "Access-Control-Allow-Headers": "Origin,Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,locale",
    //     "Access-Control-Allow-Methods": "POST, OPTIONS"
    //   },
    // });
    // console.log(reader.getRequestOptions());
    // reader
    //   .read(URL)
    //   .then((_feed) => {
    //     console.log(_feed);
    //     setFeed(_feed);
    //   })
    //   .catch((err) => {
    //     console.log(err);
    //   });
  }, []);

  return (

    <Fade arrows={false}>
    {feed.map((item: any, index: any) => (
      <div style={styles.fade} className="each-fade" key={index}>
        <div style={{ ...styles.fade, backgroundImage: `url(${item.thumbnail})` }}>
          <span>{item.title}</span>
          <br></br>
          <QRCodeSVG value={item.link} height="150px" width="150px" />,
        </div>
      </div>
    ))}
  </Fade>
  );
};

const styles = {
    fade: {
      height: "300px"
    },
  }
  
export default RSSFeed;
