import Link from 'next/link'
import React from 'react'

interface Props {
  label: string
  path: string
}

const Item: React.FC<Props> = (props) => {
  const { label, path } = props
  return (
    <Link href={path}>
      {label}
    </Link>
  )
}

export default Item