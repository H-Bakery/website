import React from "react";
import Weather from "../components/info/Weather";
import Calendar from "../components/info/Calendar";
import Slideshow from "../components/info/Slideshow";
import RSSFeed from "../components/info/RSSFeed";
import Products from "../components/info/Products";
import News from "../components/info/News";
import useDate from "../components/info/useDate";
import { featuredProducts } from "../mocks/products/featured";

import { Typography, Grid } from "@mui/material";

const Info: React.FC = () => {
  return (
    <Grid container>
      <Grid style={styles.kachel} item md={4}>
        <Grid style={{ height: "20vh" }} item md={12}>
          <Typography variant="h4">{useDate().wish}</Typography>
          <Typography variant="h2">{useDate().time}</Typography>
        </Grid>
        <Grid style={{ height: "80vh" }} item md={12}>
          <Weather />
        </Grid>
      </Grid>
      <Grid style={styles.kachel} item md={12}>
        <Grid style={styles.kachel} item sm={4}>
          <Typography variant="h5">Neuigkeiten</Typography>
          <News />
        </Grid>
        <Grid style={styles.kachel} item sm={4}>
          <Typography variant="h5">Angebote</Typography>
          <Products sx={{ py: 2 }} items={featuredProducts} />
        </Grid>

        {/* <Grid style={styles.kachel} item md={4}>
          <Typography variant="h5">Bilder</Typography>
          <Slideshow />
        </Grid> */}
      </Grid>
      <Grid style={styles.kachel} item md={12}>
        <Grid style={styles.kachel} item sm={4}>
          <Typography variant="h5">Kalender</Typography>
          <Calendar />
        </Grid>
        <Grid style={styles.kachel} item sm={4}>
          <Typography variant="h5">Regionales</Typography>
          <RSSFeed />
        </Grid>
        {/* <Grid style={styles.kachel} item md={4}>
          <Typography variant="h5">Bilder</Typography>
          <Slideshow />
        </Grid> */}
      </Grid>
    </Grid>
  );
};

const styles = {
  kachel: {
    minHeight: "500px",
    maxHeight: "500px",
    maxWidth: "300px",
    minWidth: "300px",
  },
};

export default Info;
