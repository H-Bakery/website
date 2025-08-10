'use client'
import { Box } from '@mui/material'
import { NextSeo } from 'next-seo'

import { AppConfig } from '../utils/AppConfig'
import { Header } from '../components/header'
import Footer from '../components/footer/Index'
import Head from 'next/head'
import { useRouter } from 'next/router'

interface Props {
  children: React.ReactNode
}

const Base: React.FC<Props> = ({ children }) => (
  <Box
    sx={{
      background:
        'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4',
    }}
  >
    <Meta title={AppConfig.title} description={AppConfig.description} />
    <Header />
    <Box sx={{ minHeight: 'calc(100vh - 332px)' }}>{children}</Box>
    {/* <Cart /> */}
    <Footer />
  </Box>
)

type IMetaProps = {
  title: string
  description: string
  canonical?: string
}

const Meta = (props: IMetaProps) => {
  const router = useRouter()

  return (
    <>
      <Head>
        <meta charSet="UTF-8" key="charset" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
          key="viewport"
        />
        <link
          rel="apple-touch-icon"
          href={`${process.env.basePath}/apple-touch-icon.png`}
          key="apple"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={`${process.env.basePath}/favicon-32x32.png`}
          key="icon32"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={`${process.env.basePath}/favicon-16x16.png`}
          key="icon16"
        />
        <link
          rel="icon"
          href={`${process.env.basePath}/favicon.ico`}
          key="favicon"
        />
      </Head>
      <NextSeo
        title={props.title}
        description={props.description}
        canonical={props.canonical}
        openGraph={{
          title: props.title,
          description: props.description,
          url: props.canonical,
          locale: AppConfig.locale,
          site_name: AppConfig.site_name,
        }}
      />
    </>
  )
}

export default Base
