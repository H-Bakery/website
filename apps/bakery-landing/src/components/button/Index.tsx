import React from 'react'
import { Button, ButtonProps } from '@mui/material'

/**
 * MUI-Button. Mit `href` rendert er ein `<a>` und reicht `target`/`rel` durch;
 * die MUI-Typen kennen die beiden aber nur für das Button-Element nicht,
 * deshalb hier ergänzt (wie in `@bakery/shared/ui`).
 */
export type ButtonComponentProps = ButtonProps & {
  target?: string
  rel?: string
}

const ButtonComponent: React.FC<ButtonComponentProps> = (props) => {
  return <Button {...props} />
}

export default ButtonComponent
