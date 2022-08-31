import React from "react";
import { Box, BoxProps, Container, Grid } from "@mui/material";

import Card from "../home/news/Card";
import { NEWS } from "../../mocks/news";
import { Fade } from "react-slideshow-image";

interface Props extends BoxProps {
  header?: React.ReactNode;
}

const News: React.FC<Props> = (props) => {
  const { header, sx } = props;

  return (
    <Box sx={sx}>
      <Container>
        {header}
          <Fade arrows={false}>
            {NEWS.map((item) => (
              <Grid key={item.id} item xs={12} sm={12} md={12} lg={12}>
                <Card {...item} />
              </Grid>
            ))}
          </Fade>
      </Container>
    </Box>
  );
};

export default News;
