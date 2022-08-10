import React, { useState } from "react";
import { Box, Container } from "@mui/material";

import { PRODUCTS } from "../mocks/products";
import { formatter } from "../utils/formatPrice";
import { Base } from "../layout/Base";
import Hero from "../components/Hero";
import Filter from "../components/sortiment/Filter";

const Index = () => {
  const [products, setProducts] = useState(PRODUCTS)

  return (
    <Base>
      <Hero title='Sortiment' />
      <Box>
        <Container>
          <Filter setProducts={setProducts} />
           
          <table className="table-auto">
            <thead>
              <tr>
                <th>ID</th>
                <th>Bild</th>
                <th>Name</th>
                <th>Kategorie</th>
                <th>Preis</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>
                    {" "}
                    <img src={product.image} alt={product.name} />
                  </td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{formatter.format(product.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>
      </Box>
    </Base>
  );
};

export default Index;
