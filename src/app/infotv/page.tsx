import React from 'react'
import { getAllNews } from '../../services/newsService'
import InfoTVClient from '../../components/InfoTVClient'

const InfoTV: React.FC = async () => {
  const news = getAllNews()
  
  return <InfoTVClient news={news} />
}

export default InfoTV
