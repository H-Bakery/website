import { Box, Container, Typography } from "@mui/material";
import React from "react";
// @ts-ignore 
import ReactWeather, { useVisualCrossing } from "react-open-weather";

const Weather: React.FC = () => {
  // const { data, isLoading, errorMessage } = useOpenWeather({
  //   key: "42fd370b64a8f1ffb4441045e6086a8a",
  //   lat: "49.30107377123533",
  //   lon: "7.369370264295438",
  //   lang: "en",
  //   unit: "metric", // values are (metric, standard, imperial)
  // });

  // const { data, isLoading, errorMessage } = useWeatherBit({
  //   key: '8b187f1f99a24f5286db6596f30f544a',
  //   lat: "49.30107377123533",
  //   lon: "7.369370264295438",
  //   lang: 'en',
  //   unit: 'metric', // values are (metric,us,uk)
  // });

  console.log("process", process.env.NEXT_PUBLIC_WEATHER_KEY)

  const { data, isLoading, errorMessage } = useVisualCrossing({
    key: process.env.NEXT_PUBLIC_WEATHER_KEY,
    lat: "49.30107377123533",
    lon: "7.369370264295438",
    lang: 'de',
    unit: 'metric', // values are (metric,us,uk)
  });

  return (
    <ReactWeather
      isLoading={isLoading}
      errorMessage={errorMessage}
      data={data}
      lang="de"
      locationLabel="Kirrberg"
      unitsLabels={{ temperature: "C", windSpeed: "Km/h" }}
      showForecast
    />
  );
};

export default Weather;
