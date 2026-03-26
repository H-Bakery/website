import { Header, Footer } from '@bakery/shared/ui'
import { ProductDetailPage } from '@bakery/shop/feature-catalog'

interface ProductPageProps {
  params: Promise<{ pid: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { pid } = await params
  return (
    <div>
      <Header />
      <ProductDetailPage pid={pid} />
      <Footer />
    </div>
  )
}
