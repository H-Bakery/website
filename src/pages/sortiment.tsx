import React, { useState } from "react";
import { PRODUCTS } from "../mocks/products";
import { formatter } from "../utils/formatPrice";
import { Base } from "../layout/Base";
import { Box, Button, Container, Grid, Typography } from "@mui/material";

const Index = () => {
  const [products, setProducts] = useState(PRODUCTS);

  const filter = (input: String) => {
    console.log("input", input);
    const newArray = PRODUCTS.filter((product) =>
      product.category.includes(input)
    ).map((filteredName) => filteredName);
    console.log("newArray", newArray);
    setProducts(newArray);
  };

  return (
    <Base>
      <Box sx={{ py: 6 }}>
        <Container>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 4,
            }}
          >
            <Typography variant="h1">Unser Sortiment</Typography>
          </Box>
          <button onClick={() => setProducts(PRODUCTS)}>Alles</button>
          <button onClick={() => filter("Brot")}>Brote</button>
          <button onClick={() => filter("Kaffeestückchen")}>
            Kaffeestückchen
          </button>
          <button onClick={() => filter("Snacks")}>Snacks</button>
          <button onClick={() => filter("Kuchen")}>Kuchen</button>
          <button onClick={() => filter("Torten")}>Torten</button>
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
