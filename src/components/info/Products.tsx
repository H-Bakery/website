import React from "react";
import {
  Box,
  BoxProps,
  Button,
  Container,
  Grid,
  Typography,
} from "@mui/material";
import ProductCard from "../home/products/ProductCard";
import { Product } from "../products/types";
import { Fade } from "react-slideshow-image";

interface Props extends BoxProps {
  header?: React.ReactNode;
  items: Product[];
}

const Products: React.FC<Props> = (props) => {
  const { items, header, sx } = props;

  return (
    <Box sx={sx}>
      <Container>
        <Fade arrows={false}>
          {items.map((item, index) => (
            <Grid key={item.id} item xs={12} sm={12} md={12}>
              <ProductCard {...item} />
            </Grid>
          ))}
        </Fade>
      </Container>
    </Box>
  );
};

export default Products;
