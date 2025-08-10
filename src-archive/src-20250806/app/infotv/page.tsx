import React from 'react'
import { getAllNews } from '../../services/newsService'
import InfoTVClient from '../../components/InfoTVClient'

export default async function InfoTV() {
  const news = getAllNews()

  return <InfoTVClient news={news} />
}
